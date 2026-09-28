// 移植自 Web `src/lib/navigation/foregroundLocation.ts`（commit 5eadc71）。
//
// 回到前景時要主動要一個全新的定位：背景期間定位監看可能被暫停，地圖上留著的位置可能已經是好幾個路口前。
// 差異：Web 注入瀏覽器 `Geolocation`（`maximumAge: 0`）；本版注入 `LocationPort.getCurrent`
// （expo-location 的 `getCurrentPositionAsync` 本身就是要新定位，不讀快取；快取版是 `getLastKnownPositionAsync`）。
// 保持依賴注入，不 import RN／expo，才能在 node 下測。

import type { LatLng } from '@/shared/geo';

export interface ForegroundFix {
  lat: number;
  lng: number;
  heading: number | null;
}

export interface ForegroundLocationDeps {
  /** App 目前在前景；只有前景才要求新定位。 */
  isVisible: () => boolean;
  /** 單次高精度定位；沒有可用定位來源時為 null。 */
  getCurrent: (() => Promise<ForegroundFix>) | null | undefined;
  /** 收到新定位與對地航向（有回報時）。 */
  onPosition: (location: LatLng, heading: number | null) => void;
}

/**
 * App 在前景時要求一次新定位。回傳是否真的發出請求（false＝在背景或沒有定位來源）。
 * 錯誤吞掉：既有的定位監看仍在跑，GPS 錯誤已由地圖的 gpsErrorHandler 呈現給使用者。
 */
export function requestForegroundLocationFix(deps: ForegroundLocationDeps): boolean {
  if (!deps.isVisible() || !deps.getCurrent) return false;
  const getCurrent = deps.getCurrent;
  void (async () => {
    try {
      const fix = await getCurrent();
      const heading = typeof fix.heading === 'number' && !Number.isNaN(fix.heading) ? fix.heading : null;
      deps.onPosition({ lat: fix.lat, lng: fix.lng }, heading);
    } catch {
      // 見上方說明：交給既有的定位監看。
    }
  })();
  return true;
}
