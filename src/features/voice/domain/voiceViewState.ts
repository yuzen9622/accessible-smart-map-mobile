// 移植自 Web `src/stores/useVoiceStore.ts`（commit f5027af）中可與 zustand 分離的純 reducer 邏輯與型別。
// zustand 的 setter／`bindSessionActions` 接線（Web 測試 case 14a／14b／14c）屬於 store 本體，留給 voice feature 的 store。
import type { VoiceStatus, VoiceStatusName, VoiceToolEvent, VoiceTranscript } from './voiceSession';

/**
 * `'panel'` = 語音 session 的即時 UI 顯示在聊天面板內；`'pill'` = session 在背景持續，
 * 面板（若開著）顯示一般文字聊天，改由常駐的浮動指示器提示。
 */
export type VoiceViewMode = 'panel' | 'pill';

/** `VoiceTranscript` 加上 aggregator 的 id／raw／sealed（結構同 `AggEntry`）。 */
export interface VoiceTranscriptEntry extends VoiceTranscript {
  id: number;
  raw: string;
  sealed: boolean;
}

export interface VoiceViewState {
  status: VoiceStatus;
  transcripts: VoiceTranscriptEntry[];
  activeTool: VoiceToolEvent | null;
  viewMode: VoiceViewMode;
  /** 麥克風 RMS 音量 [0, 1]。 */
  micLevel: number;
  /** 助理語音的實際播放音量 [0, 1]（播放端 AnalyserNode）。 */
  modelLevel: number;
  /** Gemini 語音輸出（與麥克風上行）是否靜音。 */
  isMuted: boolean;
}

export const initialVoiceViewState: VoiceViewState = {
  status: { status: 'idle' },
  transcripts: [],
  activeTool: null,
  viewMode: 'panel',
  micLevel: 0,
  modelLevel: 0,
  isMuted: false,
};

/**
 * Every terminal status drops the controller's mute flag, so the store has to clear its
 * mirror for all of them or the speaker button reopens on a stale `isMuted`.
 */
export function isMuteResettingStatus(status: VoiceStatusName): boolean {
  return status === 'idle' || status === 'ended' || status === 'error' || status === 'needs-login';
}

/** `setStatus`：終止類狀態順帶清掉 isMuted，其餘保留。 */
export function reduceStatus(state: VoiceViewState, status: VoiceStatus): VoiceViewState {
  return isMuteResettingStatus(status.status) ? { ...state, status, isMuted: false } : { ...state, status };
}

/** `toggleMute`：回傳新 state；呼叫端拿 `next.isMuted` 通知 controller。 */
export function reduceToggleMute(state: VoiceViewState): VoiceViewState {
  return { ...state, isMuted: !state.isMuted };
}

/** `startSession`／`endSession`：新 session 一律從未靜音開始，結束也清掉。 */
export function reduceSessionBoundary(state: VoiceViewState): VoiceViewState {
  return { ...state, isMuted: false };
}
