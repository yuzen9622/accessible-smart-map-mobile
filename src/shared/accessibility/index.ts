import { AccessibilityInfo } from 'react-native';

/**
 * 系統「減少動態效果」的同步快照，給不在 React 樹裡的程式（相機控制器、動畫參數）判斷用；
 * 元件內請用 Reanimated 的 `useReducedMotion()`。第一次 import 時開始追蹤，讀到之前視為未開啟。
 */
let reduceMotion = false;
let tracking = false;

function startTracking(): void {
  if (tracking) return;
  tracking = true;
  const load = async () => {
    try {
      reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
    } catch {
      // 讀不到就維持預設（有動畫）
    }
  };
  void load();
  AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
    reduceMotion = enabled;
  });
}

startTracking();

export function isReduceMotionEnabled(): boolean {
  return reduceMotion;
}

/** 依「減少動態效果」決定動畫長度：開啟時回傳 0（直接跳到終點）。 */
export function motionDuration(ms: number): number {
  return reduceMotion ? 0 : ms;
}
