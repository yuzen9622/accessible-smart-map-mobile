/**
 * Pure closure module carrying every piece of wiring logic between
 * `useVoiceSession` and `VoiceSessionController` (plan
 * `memory/reviews/plans/a1e4a3b4026e7400.md` §3.3, rev3 round2-F1): the
 * transcript aggregator state, the previously-seen status (for turn-boundary
 * sealing), and the mic-level zeroing rule. `useVoiceSession` is reduced to
 * a thin `useState`/`useEffect` shell that constructs one instance via a
 * stable ref and forwards controller callbacks straight into it.
 */

import { mapToolToActions, type Translate, type UIAction } from '@/features/ai/domain';
import { isOk, isRec } from '@/features/ai/domain/aiResults';
import { isRouteTool } from '@/features/ai/domain/routePlan';
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
  clearTool?(): void;
  /** Bind to `voiceLevels.mic`（store/voiceLevels.ts，SharedValue，不經過 React）. */
  setMicLevel(level: number): void;
  /** 執行同步 UI action（原生：`features/ai/controller/actionExecutor` 的 executeAction）。 */
  executeAction(action: UIAction): { ok: boolean } | void;
  getRouteGeneration?(): number;
  onRouteError?(): void;
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
  const calls = new Map<string, { event: VoiceToolEvent; generation: number }>();
  const applied = new Set<string>();

  function cancelPendingTools(): void {
    for (const id of calls.keys()) applied.add(id);
    calls.clear();
    sinks.clearTool?.();
  }

  function publishResult(event: VoiceToolEvent): void {
    if (event.callId) {
      calls.delete(event.callId);
      applied.add(event.callId);
    }
    sinks.publishTool(event);
    const pending = Array.from(calls.values()).at(-1);
    if (pending) sinks.publishTool(pending.event);
  }

  function onTranscript(transcript: TranscriptFragment): void {
    agg = appendFragment(agg, transcript);
    sinks.publishTranscripts(agg.entries);
  }

  function onTranscriptCorrection(correction: TranscriptCorrection): void {
    agg = applyCorrection(agg, correction);
    sinks.publishTranscripts(agg.entries);
  }

  function onTurnComplete(): void {
    cancelPendingTools();
    agg = sealRole(agg, 'model');
    sinks.publishTranscripts(agg.entries);
  }

  function onInterrupted(): void {
    cancelPendingTools();
    agg = sealRole(agg, 'model');
    agg = sealRole(agg, 'user');
    sinks.publishTranscripts(agg.entries);
  }

  function onStatusChange(status: VoiceStatus): void {
    if (['connecting', 'reconnecting', 'ending', 'ended', 'error', 'needs-login'].includes(status.status)) cancelPendingTools();
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
    if (event.type === 'call') {
      if (event.callId) {
        if (calls.has(event.callId) || applied.has(event.callId)) return;
        calls.set(event.callId, { event, generation: sinks.getRouteGeneration?.() ?? 0 });
      }
      sinks.publishTool(event); return;
    }
    if (event.callId && applied.has(event.callId)) return;
    const call = event.callId ? calls.get(event.callId) : undefined;
    const matches = call && call.event.name === event.name && call.event.turnId === event.turnId;
    if (isRouteTool(event.name) && (!matches || !event.turnId || call.generation !== (sinks.getRouteGeneration?.() ?? 0))) {
      sinks.onRouteError?.(); return;
    }
    if (event.callId && !matches) return;
    event = { ...event, args: event.args ?? call?.event.args };
    if (event.ok === false || (isRec(event.result) && !isOk(event.result))) {
      publishResult({ ...event, ok: false, result: undefined, args: undefined, summary: undefined });
      return;
    }
    if (isRouteTool(event.name) && event.result == null) { sinks.onRouteError?.(); return; }
    try {
      if (event.result != null) {
        for (const action of mapToolToActions(event.name, event.result, event.args, sinks.t)) {
          if (action.type === 'close-chat') continue;
          const previousGeneration = sinks.getRouteGeneration?.() ?? 0;
          if (action.type === 'route-error' || sinks.executeAction(action)?.ok === false) { sinks.onRouteError?.(); return; }
          if (action.type === 'show-route') {
            const nextGeneration = sinks.getRouteGeneration?.() ?? 0;
            for (const pending of calls.values()) {
              if (pending.generation === previousGeneration) pending.generation = nextGeneration;
            }
          }
        }
      }
    } catch {
      if (isRouteTool(event.name)) sinks.onRouteError?.();
      else publishResult({ ...event, ok: false, result: undefined, args: undefined, summary: undefined });
      return;
    }
    publishResult(isRouteTool(event.name) ? { ...event, result: undefined, args: undefined } : event);
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
    calls.clear();
    applied.clear();
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
