import { AudioContext, type AudioBufferQueueSourceNode } from 'react-native-audio-api';

import { pcm16ToFloat32 } from '../domain/pcm';
import type { VoicePlayback } from '../domain/voiceSession';
import { trackAudioTeardown } from './audioSession';

/** 下行 PCM16 LE、24 kHz、mono，chunk 長度不固定（協定 §3.4）。 */
const PLAYBACK_RATE = 24000;

/**
 * `VoicePlayback` 原生實作（取代 Web `lib/voice/audioPlayback.ts`）：`AudioBufferQueueSourceNode` 依序無縫排隊。
 * 打斷（`interrupted`）時 `clear()` 丟掉整條佇列，下一段音訊到時重建（協定 §5；對應 poc-client `clearPlayback()`）。
 * 原生沒有瀏覽器 autoplay 限制，`onBlocked` 不會觸發。
 */
export function createPlayback(): VoicePlayback {
  let context: AudioContext | null = null;
  let queue: AudioBufferQueueSourceNode | null = null;
  let muted = false;

  const ensureQueue = (): { ctx: AudioContext; node: AudioBufferQueueSourceNode } => {
    const ctx = context ?? new AudioContext({ sampleRate: PLAYBACK_RATE });
    context = ctx;
    if (queue) return { ctx, node: queue };
    const node = ctx.createBufferQueueSource();
    node.connect(ctx.destination);
    // react-native-audio-api 0.13.6：start() 預設 offset=-1 卻拒絕負值（Spike B），必須明確傳 (0, 0)
    node.start(0, 0);
    queue = node;
    return { ctx, node };
  };

  const clear = () => {
    const node = queue;
    queue = null;
    if (!node) return;
    try {
      node.clearBuffers();
      node.stop();
    } catch (error) {
      console.warn('[voice] clear playback failed', error);
    }
  };

  return {
    play(frame) {
      if (muted || frame.byteLength < 2) return;
      try {
        const samples = pcm16ToFloat32(frame);
        const { ctx, node } = ensureQueue();
        const buffer = ctx.createBuffer(1, samples.length, PLAYBACK_RATE);
        buffer.copyToChannel(samples, 0);
        node.enqueueBuffer(buffer);
      } catch (error) {
        console.warn('[voice] play frame failed', error);
      }
    },
    clear,
    dispose() {
      clear();
      const ctx = context;
      context = null;
      if (ctx) trackAudioTeardown(closeContext(ctx));
    },
    async resume() {
      try {
        await context?.resume();
        return true;
      } catch {
        return false;
      }
    },
    onBlocked() {
      // 原生沒有 autoplay 阻擋
    },
    setMuted(value) {
      muted = value;
      if (value) clear();
    },
  };
}

async function closeContext(ctx: AudioContext): Promise<void> {
  try {
    await ctx.close();
  } catch (error) {
    console.warn('[voice] close audio context failed', error);
  }
}
