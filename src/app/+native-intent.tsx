import { useNavStore } from '@/features/navigation/store/navStore';

/** 回到 App 的系統連結要開既有 sheet，不能在常駐 sheet 上再 push 一張地圖。 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path, 'accessiblesmartmap:///');
    if (url.protocol !== 'accessiblesmartmap:') return path;
    // 自訂 scheme 的雙斜線連結會把第一段路徑放在 hostname。
    const route = `/${url.hostname}${url.pathname}`.replace(/^\/+/, '/').replace(/\/+$/, '') || '/';
    if (route !== '/' && route !== '/navigation') return path;

    if (useNavStore.getState().isNavigating) return '/navigation';
    // 冷啟動沒有可續接的記憶體 session，交給首頁正常啟動（包含 onboarding）。
    // 暖啟動則沿用既有 sheet；舊即時動態不能打開空的導航面板。
    return initial ? '/' : '/explore';
  } catch {
    return path;
  }
}
