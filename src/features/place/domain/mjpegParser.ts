/**
 * 把 `multipart/x-mixed-replace` MJPEG 串流切成一張張 JPEG。兩種輸入都要處理：
 * - 原始 multipart（Android／Node）：每個 part 有標頭，台中／公路局／國道／台南四種來源都帶
 *   `Content-Length`，用長度精準切。各家 boundary 寫法不一（`---mjpeg---`、`--DIGIEVER`、
 *   `--myboundary`），因此完全不看 boundary，只看 part 標頭。
 * - 已拆好的純 JPEG（iOS）：URLSession 對 `multipart/x-mixed-replace` 有內建處理，會吃掉
 *   boundary 與 part 標頭，只把一張張 JPEG 接著交出來（實機驗證過，第一個 chunk 直接是 `FF D8`）。
 *   這時沿著 JPEG 的 segment 結構找 EOI，不用「搜尋 FFD9」這種會被 EXIF 縮圖騙到的做法。
 * 每個 part 開頭看到 `FF D8` 就走純 JPEG，否則走標頭。
 */

const MAX_HEADER_BYTES = 4096;
const MAX_FRAME_BYTES = 8 * 1024 * 1024;
const CONTENT_LENGTH = /content-length:\s*(\d+)/i;

export class MjpegFormatError extends Error {}

export interface MjpegParser {
  /** 餵入新收到的位元組，回傳這次湊齊的完整 JPEG 幀（依序）。格式不對會丟 `MjpegFormatError`。 */
  feed(chunk: Uint8Array): Uint8Array[];
}

const SOI_FF = 0xff;
const SOI_D8 = 0xd8;

/**
 * 從 `start`（必須是 `FF D8`）沿 JPEG segment 結構找 EOI，回傳 EOI 之後的位置；資料還不夠回 -1。
 * Segment 內容（含 APP1 EXIF 內嵌縮圖的 FFD9）靠長度欄位跳過；SOS 之後的熵編碼資料裡
 * `FF 00`（填充）與 `FF D0–D7`（restart）不是標記，其餘 `FF xx` 才是下一個標記。
 */
function findJpegEnd(buf: Uint8Array, length: number): number {
  let pos = 2;
  for (;;) {
    if (pos + 1 >= length) return -1;
    if (buf[pos] !== 0xff) throw new MjpegFormatError('JPEG marker expected');
    const marker = buf[pos + 1];
    if (marker === 0xff) {
      pos += 1; // fill byte
      continue;
    }
    if (marker === 0xd9) return pos + 2;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      pos += 2;
      continue;
    }
    if (pos + 3 >= length) return -1;
    const segmentLength = (buf[pos + 2] << 8) | buf[pos + 3];
    if (segmentLength < 2) throw new MjpegFormatError('JPEG segment length invalid');
    pos += 2 + segmentLength;
    if (marker !== 0xda) continue;
    // SOS：標頭之後是熵編碼資料，直到下一個真正的標記。
    for (;;) {
      if (pos + 1 >= length) return -1;
      if (buf[pos] !== 0xff) {
        pos += 1;
        continue;
      }
      const next = buf[pos + 1];
      if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) pos += 2;
      else if (next === 0xff) pos += 1;
      else break;
    }
  }
}

/** 找標頭結尾（空行）：回傳空行之後第一個 byte 的位置，找不到回 -1。容忍 CRLF 與 LF。 */
function findHeaderEnd(buf: Uint8Array, length: number): number {
  for (let i = 0; i < length - 1; i += 1) {
    if (buf[i] === 0x0a && buf[i + 1] === 0x0a) return i + 2;
    if (buf[i] === 0x0a && buf[i + 1] === 0x0d && i + 2 < length && buf[i + 2] === 0x0a) return i + 3;
  }
  return -1;
}

function asciiOf(buf: Uint8Array, end: number): string {
  let text = '';
  for (let i = 0; i < end; i += 1) text += String.fromCharCode(buf[i]);
  return text;
}

export function createMjpegParser(): MjpegParser {
  let buffer = new Uint8Array(64 * 1024);
  let length = 0;
  let pendingFrameBytes: number | null = null;

  function append(chunk: Uint8Array): void {
    if (length + chunk.length > buffer.length) {
      const grown = new Uint8Array(Math.max(buffer.length * 2, length + chunk.length));
      grown.set(buffer.subarray(0, length));
      buffer = grown;
    }
    buffer.set(chunk, length);
    length += chunk.length;
  }

  function consume(count: number): void {
    buffer.copyWithin(0, count, length);
    length -= count;
  }

  return {
    feed(chunk) {
      append(chunk);
      const frames: Uint8Array[] = [];
      for (;;) {
        if (pendingFrameBytes === null) {
          // part 之間可能夾著換行（例如 Axis 的 Content-Length 多算了結尾 CRLF，或 iOS 拆 part 後的殘留）。
          let skip = 0;
          while (skip < length && (buffer[skip] === 0x0d || buffer[skip] === 0x0a)) skip += 1;
          if (skip > 0) consume(skip);
          if (length < 2) return frames;

          if (buffer[0] === SOI_FF && buffer[1] === SOI_D8) {
            const end = findJpegEnd(buffer, length);
            if (end < 0) {
              if (length > MAX_FRAME_BYTES) throw new MjpegFormatError('JPEG frame too large');
              return frames;
            }
            frames.push(buffer.slice(0, end));
            consume(end);
            continue;
          }

          const headerEnd = findHeaderEnd(buffer, length);
          if (headerEnd < 0) {
            if (length > MAX_HEADER_BYTES) throw new MjpegFormatError('MJPEG part header too long');
            return frames;
          }
          const match = CONTENT_LENGTH.exec(asciiOf(buffer, headerEnd));
          const frameBytes = match ? Number(match[1]) : Number.NaN;
          if (!Number.isInteger(frameBytes) || frameBytes <= 0 || frameBytes > MAX_FRAME_BYTES) {
            throw new MjpegFormatError('MJPEG part has no usable Content-Length');
          }
          pendingFrameBytes = frameBytes;
          consume(headerEnd);
        }
        if (length < pendingFrameBytes) return frames;
        frames.push(buffer.slice(0, pendingFrameBytes));
        consume(pendingFrameBytes);
        pendingFrameBytes = null;
      }
    },
  };
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Hermes 沒有 `Buffer`；JPEG 幀轉 data URI 用的 base64，純 JS 實作避免逐 byte 組字串的 O(n²)。 */
export function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    parts.push(
      BASE64_ALPHABET[(triple >> 18) & 63] +
        BASE64_ALPHABET[(triple >> 12) & 63] +
        (i + 1 < bytes.length ? BASE64_ALPHABET[(triple >> 6) & 63] : '=') +
        (i + 2 < bytes.length ? BASE64_ALPHABET[triple & 63] : '='),
    );
  }
  return parts.join('');
}
