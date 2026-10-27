/**
 * 把 `multipart/x-mixed-replace` MJPEG 串流切成一張張 JPEG。台中／公路局／國道／台南四種來源
 * 每一幀都帶 `Content-Length`，所以用長度精準切，不去猜 JPEG 的 FFD8／FFD9 邊界（EXIF 縮圖裡
 * 也會出現 FFD9）。各家 boundary 寫法不一（`---mjpeg---`、`--DIGIEVER`、`--myboundary`），
 * 因此完全不看 boundary，只看每個 part 的標頭。
 */

const MAX_HEADER_BYTES = 4096;
const MAX_FRAME_BYTES = 8 * 1024 * 1024;
const CONTENT_LENGTH = /content-length:\s*(\d+)/i;

export class MjpegFormatError extends Error {}

export interface MjpegParser {
  /** 餵入新收到的位元組，回傳這次湊齊的完整 JPEG 幀（依序）。格式不對會丟 `MjpegFormatError`。 */
  feed(chunk: Uint8Array): Uint8Array[];
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
