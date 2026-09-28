// Spike B：語音協定的 PCM 轉換（後端 VOICE_WS_PROTOCOL：上行 PCM16 LE 16 kHz mono、每 frame 1600 samples；
// 下行 PCM16 LE 24 kHz mono）。Phase 4 移到 features/voice/domain。

/** Float32 [-1, 1] → PCM16 little-endian bytes（超出範圍 clamp）。 */
export function float32ToPcm16(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(i * 2, clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff), true);
  }
  return buffer;
}

/** PCM16 little-endian bytes → Float32 [-1, 1)。奇數長度的尾端位元組丟棄。 */
export function pcm16ToFloat32(bytes: ArrayBuffer): Float32Array<ArrayBuffer> {
  const view = new DataView(bytes);
  const out = new Float32Array(Math.floor(bytes.byteLength / 2));
  for (let i = 0; i < out.length; i += 1) {
    out[i] = view.getInt16(i * 2, true) / 0x8000;
  }
  return out;
}

/**
 * 把任意長度的擷取 buffer 重新切成固定 frame（例如 1600 samples）。
 * 不足一個 frame 的尾巴留到下一次 push。
 */
export function createFrameChunker(frameLength: number) {
  let pending = new Float32Array(0);
  return {
    push(samples: Float32Array): Float32Array[] {
      const merged = new Float32Array(pending.length + samples.length);
      merged.set(pending);
      merged.set(samples, pending.length);
      const frames: Float32Array[] = [];
      let offset = 0;
      while (merged.length - offset >= frameLength) {
        frames.push(merged.slice(offset, offset + frameLength));
        offset += frameLength;
      }
      pending = merged.slice(offset);
      return frames;
    },
    pendingLength(): number {
      return pending.length;
    },
  };
}

export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}
