import { useNavStore } from '@/features/navigation/store/navStore';
// 只引入純 domain 函式：+native-intent 在冷啟動最早執行，不能拉進整個 sos feature（畫面、音訊模組）。
import { readSosTrackingToken } from '@/features/sos/domain/sosDisplay';

/**
 * Universal Link／App Link：LINE 通知與分享的 `https://<web>/{zh-TW|en}/sos/#token=<shareToken>`
 * （app.json 只認領 path）改開原生家人追蹤 sheet。fragment 優先，並相容舊 `?token=`；token 不合法就回首頁。
 */
function sosLinkRoute(url: URL): string | null {
  if (!/^\/(zh-TW|en)\/sos\/?$/.test(url.pathname)) return null;
  const token = readSosTrackingToken(url);
  return token ? `/sos-track/${token}` : '/';
}

/** 回到 App 的系統連結要開既有 sheet，不能在常駐 sheet 上再 push 一張地圖。 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path, 'accessiblesmartmap:///');
    if (url.protocol === 'https:' || url.protocol === 'http:') return sosLinkRoute(url) ?? path;
    if (url.protocol !== 'accessiblesmartmap:') return path;
    // 自訂 scheme 的雙斜線連結會把第一段路徑放在 hostname。
    const route = `/${url.hostname}${url.pathname}`.replace(/^\/+/, '/').replace(/\/+$/, '') || '/';
    if (route === '/sos-track') {
      const token = readSosTrackingToken(url);
      return token ? `/sos-track/${token}` : '/';
    }
    if (route !== '/' && route !== '/navigation') return path;

    if (useNavStore.getState().isNavigating) return '/navigation';
    // 冷啟動沒有可續接的記憶體 session，交給首頁正常啟動（包含 onboarding）。
    // 暖啟動則沿用既有 sheet；舊即時動態不能打開空的導航面板。
    return initial ? '/' : '/explore';
  } catch {
    return path;
  }
}
