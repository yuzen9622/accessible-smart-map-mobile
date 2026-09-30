import { createFrameChunker, float32ToPcm16, pcm16ToFloat32, rms } from '../pcm';

describe('float32ToPcm16', () => {
  it('轉成 little-endian Int16 並 clamp', () => {
    const view = new DataView(float32ToPcm16(new Float32Array([0, 1, -1, 2, -2, 0.5])));
    expect(view.byteLength).toBe(12);
    expect(view.getInt16(0, true)).toBe(0);
    expect(view.getInt16(2, true)).toBe(32767);
    expect(view.getInt16(4, true)).toBe(-32768);
    expect(view.getInt16(6, true)).toBe(32767);
    expect(view.getInt16(8, true)).toBe(-32768);
    expect(view.getInt16(10, true)).toBe(16384);
    // little-endian：0x4000 → 低位元組 0x00 在前
    expect(new Uint8Array(view.buffer)[10]).toBe(0x00);
    expect(new Uint8Array(view.buffer)[11]).toBe(0x40);
  });

  it('1600 samples 的 frame 為 3200 bytes（協定上限 64KB 內）', () => {
    expect(float32ToPcm16(new Float32Array(1600)).byteLength).toBe(3200);
  });
});

describe('pcm16ToFloat32', () => {
  it('與 float32ToPcm16 往返誤差小於 2/32768（編碼 ×32767、解碼 ÷32768 的不對稱）', () => {
    const input = new Float32Array([0, 0.25, -0.25, 0.999, -1]);
    const output = pcm16ToFloat32(float32ToPcm16(input));
    input.forEach((value, i) => expect(Math.abs((output[i] ?? 0) - value)).toBeLessThan(2 / 32768));
  });

  it('奇數長度丟棄尾端位元組', () => {
    expect(pcm16ToFloat32(new ArrayBuffer(5)).length).toBe(2);
  });
});

describe('createFrameChunker', () => {
  it('把不定長度的 buffer 切成固定 1600 frame，尾巴留到下次', () => {
    const chunker = createFrameChunker(1600);
    expect(chunker.push(new Float32Array(1000))).toHaveLength(0);
    expect(chunker.pendingLength()).toBe(1000);
    const frames = chunker.push(new Float32Array(2500).fill(0.5));
    expect(frames).toHaveLength(2);
    expect(frames.every((frame) => frame.length === 1600)).toBe(true);
    expect(chunker.pendingLength()).toBe(300);
    expect(frames[0]?.[999]).toBe(0);
    expect(frames[0]?.[1000]).toBe(0.5);
  });
});

describe('rms', () => {
  it('空陣列為 0，常數振幅等於絕對值', () => {
    expect(rms(new Float32Array(0))).toBe(0);
    expect(rms(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5);
  });
});
