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

describe('bytesToBase64', () => {
  it.each(['', 'f', 'fo', 'foo', 'foob', 'fooba', 'foobar'])('matches the reference encoding for %j', (text) => {
    expect(bytesToBase64(encoder.encode(text))).toBe(Buffer.from(text).toString('base64'));
  });

  it('encodes arbitrary binary bytes', () => {
    const bytes = Uint8Array.from([0, 255, 128, 1, 254, 77, 0xff, 0xd8]);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });
});
