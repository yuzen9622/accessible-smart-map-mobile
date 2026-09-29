import { create } from 'zustand';

import type { SosLifecycleStatus } from '../domain/sosLifecycle';
import type { EmergencyContact, SosSnapshot, SosType } from '../domain/types';

/**
 * 發起者的 SOS 狀態（對應 Web `SosDialog` 的 component state；原生改放 store，因為 SOS 要跨畫面存在：
 * 關掉 SOS 畫面、切到地圖時仍在上傳位置，地圖上的 SOS 按鈕也要顯示進行中）。
 */
export type SosPhase = 'idle' | 'countdown' | 'creating' | 'active' | 'resolved';

interface SosState {
  phase: SosPhase;
  sessionId: string | null;
  shareToken: string | null;
  snapshot: SosSnapshot | null;
  lifecycleStatus: SosLifecycleStatus;
  contacts: EmergencyContact[];
  address: string | null;
  /** 使用者補充的狀況（只在本機顯示，Web 同樣不上傳）。 */
  supplementedType: SosType | null;
  /** 位置同步第一次失敗時提示一次（對齊 Web failCount）。 */
  locationSyncFailed: boolean;
  /** 背景定位沒拿到「永遠允許」：鎖屏後位置可能不會更新。 */
  backgroundDenied: boolean;
  /** 倒數剩餘毫秒（`phase === 'countdown'` 時有意義）。 */
  countdownRemainingMs: number;
  /** 建立失敗的原因，畫面顯示後呼叫 `clearSosStartError`。 */
  startError: { reason: 'noLocation' | 'failed'; message?: string } | null;
}

export const INITIAL_SOS_STATE: SosState = {
  phase: 'idle',
  sessionId: null,
  shareToken: null,
  snapshot: null,
  lifecycleStatus: 'connecting',
  contacts: [],
  address: null,
  supplementedType: null,
  locationSyncFailed: false,
  backgroundDenied: false,
  countdownRemainingMs: 5000,
  startError: null,
};

export const useSosStore = create<SosState>(() => INITIAL_SOS_STATE);

export function selectSosInProgress(state: SosState): boolean {
  return state.phase === 'creating' || state.phase === 'active';
}
