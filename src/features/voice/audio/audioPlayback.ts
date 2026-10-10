import { AudioContext, type AnalyserNode, type AudioBufferQueueSourceNode } from 'react-native-audio-api';

import { floatLevel } from '../domain/audioLevel';
import { pcm16ToFloat32 } from '../domain/pcm';
import type { VoicePlayback } from '../domain/voiceSession';
import { trackAudioTeardown } from './audioSession';
import { logger } from '@/shared/logger';

/** 下行 PCM16 LE、24 kHz、mono，chunk 長度不固定（協定 §3.4）。 */
const PLAYBACK_RATE = 24000;
/** 播放音量取樣頻率（約 30 fps，給語音音波用）。 */
const METER_INTERVAL_MS = 33;
/** 音量變化小於這個值就不回報，避免靜音尾巴每 33ms 寫一次 store。 */
const METER_EPSILON = 0.01;
/** 連續這麼多次取樣都是靜音（約 2 秒，避開句間停頓）就停掉取樣；下一段音訊排進來時再開。 */
const METER_IDLE_TICKS = 60;

/**
 * `VoicePlayback` 原生實作（取代 Web `lib/voice/audioPlayback.ts`）：`AudioBufferQueueSourceNode` 依序無縫排隊。
 * 打斷（`interrupted`）時 `clear()` 丟掉整條佇列，下一段音訊到時重建（協定 §5；對應 poc-client `clearPlayback()`）。
 * 原生沒有瀏覽器 autoplay 限制，`onBlocked` 不會觸發。
 */
export interface PlaybackObserver {
  /** 一段音訊排進佇列（毫秒）；回音閘門用它推算喇叭何時還在出聲。 */
  onScheduled?(durationMs: number): void;
  /** 佇列被清空（打斷、靜音、結束）。 */
  onCleared?(): void;
  /** 喇叭實際輸出的音量 [0, 1]（AnalyserNode 取樣，與聲音同步）；停止播放時回報 0。 */
  onLevel?(level: number): void;
}

export function createPlayback(observer: PlaybackObserver = {}): VoicePlayback {
  let context: AudioContext | null = null;
  let queue: AudioBufferQueueSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let meter: ReturnType<typeof setInterval> | null = null;
  let lastLevel = 0;
  let muted = false;
  const pendingBuffers = new Set<string>();
  let onDrained: (() => void) | undefined;

  const reportLevel = (level: number) => {
    if (Math.abs(level - lastLevel) < METER_EPSILON && !(level === 0 && lastLevel !== 0)) return;
    lastLevel = level;
    observer.onLevel?.(level);
  };

  const stopMeter = () => {
    if (meter) clearInterval(meter);
    meter = null;
    reportLevel(0);
  };

  // 佇列是預先排好的，收到 chunk 的當下算 RMS 會跟聲音對不上；改從輸出端的 AnalyserNode 取樣
  const startMeter = (node: AnalyserNode) => {
    if (meter || !observer.onLevel) return;
    const samples = new Float32Array(node.fftSize);
    let silentTicks = 0;
    meter = setInterval(() => {
      let level = 0;
      try {
        node.getFloatTimeDomainData(samples);
        level = floatLevel(samples);
      } catch {
        level = 0;
      }
      reportLevel(level);
      // 佇列播完後輸出一直是靜音；不停掉的話整段對話都會每 33ms 在 JS thread 取樣一次
      silentTicks = level < METER_EPSILON ? silentTicks + 1 : 0;
      if (silentTicks >= METER_IDLE_TICKS) stopMeter();
    }, METER_INTERVAL_MS);
  };

  const ensureAnalyser = (ctx: AudioContext): AnalyserNode => {
    if (analyser) return analyser;
    const node = ctx.createAnalyser();
    node.fftSize = 1024;
    node.connect(ctx.destination);
    analyser = node;
    return node;
  };

  const ensureQueue = (): { ctx: AudioContext; node: AudioBufferQueueSourceNode } => {
    const ctx = context ?? new AudioContext({ sampleRate: PLAYBACK_RATE });
    context = ctx;
    if (queue) return { ctx, node: queue };
    const node = ctx.createBufferQueueSource();
    node.onBufferEnded = ({ bufferId }) => {
      if (queue !== node) return;
      pendingBuffers.delete(bufferId);
      if (pendingBuffers.size === 0) onDrained?.();
    };
    const meterNode = ensureAnalyser(ctx);
    node.connect(meterNode);
    startMeter(meterNode);
    // react-native-audio-api 0.13.6：start() 預設 offset=-1 卻拒絕負值（Spike B），必須明確傳 (0, 0)
    node.start(0, 0);
    queue = node;
    return { ctx, node };
  };

  const clear = () => {
    observer.onCleared?.();
    stopMeter();
    const node = queue;
    queue = null;
    pendingBuffers.clear();
    if (!node) return;
    node.onBufferEnded = null;
    try {
      node.clearBuffers();
      node.stop();
    } catch (error) {
      logger.warn('[voice] clear playback failed', error);
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
        pendingBuffers.add(node.enqueueBuffer(buffer));
        if (analyser) startMeter(analyser);
        observer.onScheduled?.((samples.length / PLAYBACK_RATE) * 1000);
      } catch (error) {
        logger.warn('[voice] play frame failed', error);
      }
    },
    clear,
    isPlaying: () => pendingBuffers.size > 0,
    onDrained(callback) { onDrained = callback; },
    dispose() {
      clear();
      analyser = null;
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
    logger.warn('[voice] close audio context failed', error);
  }
}
