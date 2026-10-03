// 移植自 Web `src/lib/voice/voiceSessionBindings.ts`（commit f5027af）。與 Web 的差異：
// - Web 直接 import `executeAction`（有副作用的 UI 執行器）；原生 domain 不能依賴 controller，改由 sinks 注入：
//   `executeAction(action)` 執行同步 UI action，`computeRoute(origin, destination)` 是獨立的 async sink
//   （SDD §6.6 雙路徑不變量：async action 由語音與聊天兩條路徑各自 await，不進 executeAction）。
// - `mapToolToActions` 多收一個 `t`（標記預設標題翻譯）。
// - 保留 Web 語意：`close-chat` 在語音中略過（語音面板本身就是聊天面板的一部分）。
/**
 * Pure closure module carrying every piece of wiring logic between
 * `useVoiceSession` and `VoiceSessionController` (plan
 * `memory/reviews/plans/a1e4a3b4026e7400.md` §3.3, rev3 round2-F1): the
 * transcript aggregator state, the previously-seen status (for turn-boundary
 * sealing), and the mic-level zeroing rule. `useVoiceSession` is reduced to
 * a thin `useState`/`useEffect` shell that constructs one instance via a
 * stable ref and forwards controller callbacks straight into it.
 */

import { mapToolToActions, type LatLng, type Translate, type UIAction } from '@/features/ai/domain';
import { logger } from '@/shared/logger';
import { isMicActiveStatus, wrapFrameHandler } from './audioLevel';
import {
  type AggEntry,
  type AggState,
  appendFragment,
  applyCorrection,
  applyStatusTransition,
  detachUtteranceIds,
  emptyAggState,
  sealRole,
  type TranscriptCorrection,
  type TranscriptFragment,
} from './transcriptAggregator';
import type {
  VoiceStatus,
  VoiceStatusName,
  VoiceToolEvent,
} from './voiceSession';

export interface BindingSinks {
  /** Bind to the hook's `setTranscripts` (React state). */
  publishTranscripts(entries: AggEntry[]): void;
  /** Bind to the hook's `setStatusState` (and its `statusRef` update). */
  publishStatus(status: VoiceStatus): void;
  /** Bind to the hook's `setActiveTool`. */
  publishTool(event: VoiceToolEvent): void;
  /** Bind to `voiceLevels.mic`（store/voiceLevels.ts，SharedValue，不經過 React）. */
  setMicLevel(level: number): void;
  /** 執行同步 UI action（原生：`features/ai/controller/actionExecutor` 的 executeAction）。 */
  executeAction(action: UIAction): void;
  /**
   * 規劃路線（async，不進 executeAction）。回傳的 Promise 由 bindings 接手 await；
   * 呼叫端在這裡做「算路 → 更新 route store／sheet」。
   */
  computeRoute(origin: LatLng, destination: LatLng): Promise<unknown>;
  /** computeRoute 失敗時通知（選用）；未提供則只 console.warn。 */
  onComputeRouteError?(error: unknown): void;
  /** i18n 翻譯器，傳給 `mapToolToActions`。 */
  t: Translate;
}

export interface VoiceBindings {
  onTranscript(transcript: TranscriptFragment): void;
  onTranscriptCorrection(correction: TranscriptCorrection): void;
  onTurnComplete(): void;
  onInterrupted(): void;
  onStatusChange(status: VoiceStatus): void;
  onToolEvent(event: VoiceToolEvent): void;
  /** = `wrapFrameHandler(forward, <gated setMicLevel>)`. */
  wrapCaptureFrame(
    forward: (frame: ArrayBuffer) => void,
  ): (frame: ArrayBuffer) => void;
  /**
   * Mirrors the controller's mute flag. Muting discards the microphone
   * uplink, so the recording dot must stop reacting to input too — otherwise
   * the UI keeps showing a live mic that is no longer being heard.
   */
  setMuted(muted: boolean): void;
  /** `startSession` calls this instead of clearing transcripts itself. */
  reset(): void;
  /** Unmount cleanup: zeroes the mic level. */
  dispose(): void;
}

export function createVoiceBindings(sinks: BindingSinks): VoiceBindings {
  let agg: AggState = emptyAggState();
  let currentStatus: VoiceStatusName = 'idle';
  let muted = false;

  function onTranscript(transcript: TranscriptFragment): void {
    agg = appendFragment(agg, transcript);
    sinks.publishTranscripts(agg.entries);
  }

  function onTranscriptCorrection(correction: TranscriptCorrection): void {
    agg = applyCorrection(agg, correction);
    sinks.publishTranscripts(agg.entries);
  }

  function onTurnComplete(): void {
    agg = sealRole(agg, 'model');
    sinks.publishTranscripts(agg.entries);
  }

  function onInterrupted(): void {
    agg = sealRole(agg, 'model');
    agg = sealRole(agg, 'user');
    sinks.publishTranscripts(agg.entries);
  }

  function onStatusChange(status: VoiceStatus): void {
    agg = applyStatusTransition(agg, currentStatus, status.status);
    // 重連後伺服器 utteranceId 重新編號，舊 id 必須失效（見 detachUtteranceIds）。
    if (status.status === 'reconnecting') agg = detachUtteranceIds(agg);
    sinks.publishTranscripts(agg.entries);
    sinks.publishStatus(status);
    if (!isMicActiveStatus(status.status)) {
      sinks.setMicLevel(0);
    }
    currentStatus = status.status;
  }

  function onToolEvent(event: VoiceToolEvent): void {
    sinks.publishTool(event);

    if (event.type === 'result' && event.result != null) {
      const actions = mapToolToActions(event.name, event.result, event.args, sinks.t);
      for (const action of actions) {
        if (action.type === 'close-chat') continue;
        if (action.type === 'compute-route') {
          void runComputeRoute(action.origin, action.destination);
          continue;
        }
        sinks.executeAction(action);
      }
    }
  }

  async function runComputeRoute(origin: LatLng, destination: LatLng): Promise<void> {
    try {
      await sinks.computeRoute(origin, destination);
    } catch (error) {
      if (sinks.onComputeRouteError) {
        sinks.onComputeRouteError(error);
      } else {
        logger.warn('[voiceSessionBindings] computeRoute failed', error);
      }
    }
  }

  function wrapCaptureFrame(
    forward: (frame: ArrayBuffer) => void,
  ): (frame: ArrayBuffer) => void {
    return wrapFrameHandler(forward, (level) => {
      // Reviewer round-3 non-blocking suggestion: a capture frame can
      // arrive after the status already left a mic-active state (capture
      // isn't stopped synchronously with every transition, e.g.
      // playback-blocked). Forward the frame either way, but don't let a
      // late frame repopulate `micLevel` once `onStatusChange` has already
      // zeroed it for a non-active status.
      if (muted || !isMicActiveStatus(currentStatus)) return;
      sinks.setMicLevel(level);
    });
  }

  function setMuted(nextMuted: boolean): void {
    muted = nextMuted;
    if (muted) sinks.setMicLevel(0);
  }

  function reset(): void {
    agg = emptyAggState();
    currentStatus = 'idle';
    muted = false;
    sinks.publishTranscripts([]);
  }

  function dispose(): void {
    sinks.setMicLevel(0);
  }

  return {
    onTranscript,
    onTranscriptCorrection,
    onTurnComplete,
    onInterrupted,
    onStatusChange,
    onToolEvent,
    wrapCaptureFrame,
    setMuted,
    reset,
    dispose,
  };
}
