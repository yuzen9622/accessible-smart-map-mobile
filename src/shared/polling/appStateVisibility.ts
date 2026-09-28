import { AppState } from 'react-native';

import type { VisibilitySource } from './poller';

/**
 * 以 RN `AppState` 實作的前景狀態（取代 Web 的 `document.hidden`／`visibilitychange`）。
 * `background` 與 `inactive`（iOS 下拉通知中心、來電）都暫停，避免在使用者看不到時打 API。
 * 冷啟動時 `currentState` 可能還是 `unknown`／null：當成前景，否則要等到下一個 change 事件才會開始輪詢。
 */
function isForeground(state: string | null | undefined): boolean {
  return state !== 'background' && state !== 'inactive';
}

export const appStateVisibility: VisibilitySource = {
  isActive: () => isForeground(AppState.currentState),
  subscribe(onChange) {
    const subscription = AppState.addEventListener('change', (state) => onChange(isForeground(state)));
    return () => subscription.remove();
  },
};
