import { AudioContext, type AnalyserNode, type AudioBufferQueueSourceNode, type AudioBufferSourceNode } from 'react-native-audio-api';

import { floatLevel } from '../domain/audioLevel';
import { ECHO_TAIL_MS } from '../domain/echoGate';
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
const CUE_TIMEOUT_MS = 2000;
const CUE_SOURCES: Record<'start' | 'end', number> = {
  start: require('../../../../assets/sounds/assistant-start.wav'),
  end: require('../../../../assets/sounds/assistant-end.wav'),
};

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
  /** 提示音含解碼與尾音期間，暫停其他本機播報。 */
  onCueActivity?(active: boolean): void;
}

export function createPlayback(observer: PlaybackObserver = {}): VoicePlayback {
  let context: AudioContext | null = null;
  let queue: AudioBufferQueueSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let meter: ReturnType<typeof setInterval> | null = null;
  let lastLevel = 0;
  let muted = false;
  let disposed = false;
  let cue: { cancel(): void } | null = null;
  const bufferedFrames: ArrayBuffer[] = [];
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

  const ensureContext = (): AudioContext => {
    context ??= new AudioContext({ sampleRate: PLAYBACK_RATE });
    return context;
  };

  const ensureQueue = (): { ctx: AudioContext; node: AudioBufferQueueSourceNode } => {
    const ctx = ensureContext();
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

  const clearModel = () => {
    bufferedFrames.length = 0;
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

  const clear = () => {
    clearModel();
    cue?.cancel();
  };

  const play = (frame: ArrayBuffer) => {
    if (disposed || muted || frame.byteLength < 2) return;
    if (cue) {
      bufferedFrames.push(frame);
      return;
    }
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
  };

  const playCue = (kind: 'start' | 'end'): Promise<void> => {
    if (disposed) return Promise.resolve();
    cue?.cancel();
    return new Promise<void>((resolve) => {
      let source: AudioBufferSourceNode | null = null;
      let tail: ReturnType<typeof setTimeout> | null = null;
      let finished = false;
      const finish = (flush: boolean) => {
        if (finished) return;
        finished = true;
        clearTimeout(deadline);
        if (tail !== null) clearTimeout(tail);
        if (source) {
          source.onEnded = null;
          try { source.stop(); } catch (error) {
            logger.warn('[voice] stop cue failed', error);
          }
          try { source.disconnect(); } catch (error) {
            logger.warn('[voice] disconnect cue failed', error);
          }
        }
        if (cue === currentCue) cue = null;
        observer.onCueActivity?.(false);
        resolve();
        if (flush) {
          const frames = bufferedFrames.splice(0);
          for (const frame of frames) play(frame);
        }
      };
      const currentCue = { cancel: () => finish(false) };
      cue = currentCue;
      const deadline = setTimeout(() => {
        logger.warn('[voice] cue timed out', kind);
        finish(true);
      }, CUE_TIMEOUT_MS);
      observer.onCueActivity?.(true);
      const run = async () => {
        const ctx = ensureContext();
        const buffer = await ctx.decodeAudioData(CUE_SOURCES[kind]);
        if (finished || disposed || cue !== currentCue) return;
        source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.onEnded = () => {
          if (finished || tail !== null) return;
          if (source) source.onEnded = null;
          if (kind === 'start') tail = setTimeout(() => finish(true), ECHO_TAIL_MS);
          else finish(true);
        };
        source.start(0, 0);
        observer.onScheduled?.(buffer.duration * 1000);
      };
      void run().catch((error: unknown) => {
        if (finished) return;
        logger.warn('[voice] play cue failed', error);
        finish(true);
      });
    });
  };

  return {
    play,
    playCue,
    clear,
    isPlaying: () => pendingBuffers.size > 0 || bufferedFrames.length > 0,
    onDrained(callback) { onDrained = callback; },
    dispose() {
      disposed = true;
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
      if (value) clearModel();
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
