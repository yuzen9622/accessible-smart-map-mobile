import { create } from 'zustand';

import { initialVoiceViewState, type VoiceViewMode, type VoiceViewState } from '../domain/voiceViewState';

interface VoiceStore extends VoiceViewState {
  setViewMode: (mode: VoiceViewMode) => void;
}

/**
 * 語音 UI 的鏡像狀態（對應 Web `useVoiceStore`）。寫入只經過 `controller/voiceController.ts`；
 * 狀態轉換規則在 domain `voiceViewState.ts`（reduceStatus／reduceToggleMute／reduceSessionBoundary）。
 */
export const useVoiceStore = create<VoiceStore>((set) => ({
  ...initialVoiceViewState,
  setViewMode: (viewMode) => set({ viewMode }),
}));
