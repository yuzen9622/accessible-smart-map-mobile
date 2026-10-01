import { create } from 'zustand';

import { initialVoiceViewState, type VoiceViewMode, type VoiceViewState } from '../domain/voiceViewState';

/** 語音按鈕在視窗中的中心與尺寸：語音畫面從這裡「長」出音波（過場動畫的起點）。 */
export interface VoiceLaunchOrigin {
  x: number;
  y: number;
  size: number;
  /** 按下的時間（`Date.now()`）；語音畫面只接受剛按下的起點。 */
  at: number;
}

interface VoiceStore extends VoiceViewState {
  setViewMode: (mode: VoiceViewMode) => void;
  /** 只給過場動畫用；語音畫面播完開場動畫就清掉。 */
  launchOrigin: VoiceLaunchOrigin | null;
  setLaunchOrigin: (origin: VoiceLaunchOrigin | null) => void;
}

/**
 * 語音 UI 的鏡像狀態（對應 Web `useVoiceStore`）。寫入只經過 `controller/voiceController.ts`；
 * 狀態轉換規則在 domain `voiceViewState.ts`（reduceStatus／reduceToggleMute／reduceSessionBoundary）。
 * `launchOrigin` 是純 UI 的過場起點，由語音按鈕寫入。
 */
export const useVoiceStore = create<VoiceStore>((set) => ({
  ...initialVoiceViewState,
  setViewMode: (viewMode) => set({ viewMode }),
  launchOrigin: null,
  setLaunchOrigin: (launchOrigin) => set({ launchOrigin }),
}));
