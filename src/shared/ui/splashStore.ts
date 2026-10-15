import { create } from 'zustand';

/**
 * 記錄 `SplashIntro` 的淡出動畫是否已結束。`MapScreen` 的常駐首頁 sheet 靠這個旗標延後
 * `router.navigate`，避免 sheet 在 splash 動畫跑完前就滑上來（使用者回饋 2026-10-15）。
 */
interface SplashState {
  done: boolean;
  markDone: () => void;
}

export const useSplashStore = create<SplashState>((set) => ({
  done: false,
  markDone: () => set({ done: true }),
}));
