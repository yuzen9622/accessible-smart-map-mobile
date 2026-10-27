import { bytesToBase64, createMjpegParser, MjpegFormatError } from '../mjpegParser';

const encoder = new TextEncoder();

function part(boundary: string, payload: Uint8Array, headerCase: 'Content-Length' | 'content-length' = 'Content-Length'): Uint8Array {
  const head = encoder.encode(`${boundary}\r\nContent-Type: image/jpeg\r\n${headerCase}: ${payload.length}\r\n\r\n`);
  const tail = encoder.encode('\r\n');
  const out = new Uint8Array(head.length + payload.length + tail.length);
  out.set(head, 0);
  out.set(payload, head.length);
  out.set(tail, head.length + payload.length);
  return out;
}

// 刻意在 payload 中間放 FFD9 與 "Content-Length: 1" 文字，確認只認標頭宣告的長度。
const frameA = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 1, 2, 3, ...encoder.encode('Content-Length: 1\r\n\r\n'), 0xff, 0xd9]);
const frameB = Uint8Array.from([0xff, 0xd8, 9, 8, 7, 0xff, 0xd9]);

function concat(...arrays: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

describe('createMjpegParser', () => {
  it.each([
    ['---mjpeg---', 'Content-Length' as const],
    ['--DIGIEVER', 'content-length' as const],
    ['--myboundary', 'Content-Length' as const],
  ])('extracts frames for boundary %s', (boundary, headerCase) => {
    const parser = createMjpegParser();
    const frames = parser.feed(concat(part(boundary, frameA, headerCase), part(boundary, frameB, headerCase)));
    expect(frames).toEqual([frameA, frameB]);
  });

  it('reassembles a frame split across arbitrary chunk boundaries', () => {
    const stream = concat(part('---mjpeg---', frameA), part('---mjpeg---', frameB));
    const parser = createMjpegParser();
    const frames: Uint8Array[] = [];
    for (let i = 0; i < stream.length; i += 5) frames.push(...parser.feed(stream.subarray(i, i + 5)));
    expect(frames).toEqual([frameA, frameB]);
  });

  it('waits for the rest of a partial frame', () => {
    const stream = part('--b', frameA);
    const parser = createMjpegParser();
    expect(parser.feed(stream.subarray(0, stream.length - 6))).toEqual([]);
    expect(parser.feed(stream.subarray(stream.length - 6))).toEqual([frameA]);
  });

  it('rejects a part without Content-Length', () => {
    const parser = createMjpegParser();
    const bad = encoder.encode('--b\r\nContent-Type: image/jpeg\r\n\r\nxxxx');
    expect(() => parser.feed(bad)).toThrow(MjpegFormatError);
  });

  it('rejects data that never forms a header', () => {
    const parser = createMjpegParser();
    expect(() => parser.feed(new Uint8Array(5000).fill(0x41))).toThrow(MjpegFormatError);
  });
});

/** 組一張結構合法的 JPEG：APP1 內含假的 FFD9（EXIF 縮圖）、SOS 熵編碼資料含 FF00 與 FFD0。 */
function makeJpeg(seed: number): Uint8Array {
  const app1Body = [0x45, 0x78, 0xff, 0xd9, 0xff, 0xd8, seed];
  const app1 = [0xff, 0xe1, 0x00, app1Body.length + 2, ...app1Body];
  const sosHeader = [0xff, 0xda, 0x00, 0x08, 1, 1, 0x00, 0, 63, 0];
  const entropy = [seed, 0xff, 0x00, 0x12, 0xff, 0xd0, 0x34, 0xff, 0x00, seed];
  return Uint8Array.from([0xff, 0xd8, ...app1, ...sosHeader, ...entropy, 0xff, 0xd9]);
}

describe('createMjpegParser with bare JPEGs (iOS strips multipart headers)', () => {
  const a = makeJpeg(1);
  const b = makeJpeg(2);

  it('splits back-to-back JPEGs, ignoring FFD9 inside EXIF and entropy-coded data', () => {
    expect(createMjpegParser().feed(concat(a, b))).toEqual([a, b]);
  });

  it('reassembles across arbitrary chunk boundaries', () => {
    const stream = concat(a, b, a);
    const parser = createMjpegParser();
    const frames: Uint8Array[] = [];
    for (let i = 0; i < stream.length; i += 3) frames.push(...parser.feed(stream.subarray(i, i + 3)));
    expect(frames).toEqual([a, b, a]);
  });

  it('tolerates CRLF between frames (Axis counts it in Content-Length)', () => {
    const crlf = encoder.encode('\r\n');
    expect(createMjpegParser().feed(concat(a, crlf, b, crlf))).toEqual([a, b]);
  });

  it('can mix raw multipart parts and bare JPEGs', () => {
    expect(createMjpegParser().feed(concat(part('--b', a), b))).toEqual([a, b]);
  });

  it('rejects a corrupt segment structure', () => {
    const bad = Uint8Array.from([0xff, 0xd8, 0x12, 0x34, 0x56]);
    expect(() => createMjpegParser().feed(bad)).toThrow(MjpegFormatError);
  });
});

describe('bytesToBase64', () => {
  it.each(['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar'])('matches the reference encoding for %j', (text) => {
    expect(bytesToBase64(encoder.encode(text))).toBe(Buffer.from(text).toString('base64'));
  });

  it('encodes arbitrary binary bytes', () => {
    const bytes = Uint8Array.from([0, 255, 128, 1, 254, 77, 0xff, 0xd8]);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });
});
