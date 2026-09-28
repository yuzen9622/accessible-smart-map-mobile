// 從 Web `src/hook/useAnimatedBuses.ts`（commit 5eadc71）抽出的純計算：兩次輪詢之間把公車 marker
// 從目前畫的位置補間到新座標，讓車沿路滑動而不是瞬移。Web 在 hook 裡用 requestAnimationFrame 直接算；
// 本版把「建立補間」「取某一幀」拆成純函式，動畫驅動（Reanimated／rAF、減少動態效果時直接跳到終點）
// 留給地圖圖層元件。

import { bearingDeg } from '@/features/route/domain';

import type { LiveBus } from '../types/transit';

export interface AnimatedBus extends LiveBus {
  /** 由上一次移動推得的方位角（度，0 = 北）。 */
  bearing: number;
}

export interface DrawnPosition {
  lat: number;
  lng: number;
  bearing: number;
}

export interface BusTween {
  bus: LiveBus;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  bearing: number;
}

export const BUS_TWEEN_DURATION_MS = 1200;

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * 以車牌對應前後兩次資料：舊車牌從目前畫的位置補間到新座標；新車牌直接出現在回報位置；
 * 位置沒動時沿用上一次的方位角。消失的車牌由呼叫端依回傳的清單自然丟掉。
 */
export function buildBusTweens(buses: LiveBus[], drawn: ReadonlyMap<string, DrawnPosition>): BusTween[] {
  return buses.map((bus) => {
    const prev = drawn.get(bus.plateNumb);
    const fromLat = prev?.lat ?? bus.lat;
    const fromLng = prev?.lng ?? bus.lng;
    const moved = Math.abs(fromLat - bus.lat) > 1e-7 || Math.abs(fromLng - bus.lng) > 1e-7;
    const bearing = moved
      ? bearingDeg({ lat: fromLat, lng: fromLng }, { lat: bus.lat, lng: bus.lng })
      : (prev?.bearing ?? 0);
    return { bus, fromLat, fromLng, toLat: bus.lat, toLng: bus.lng, bearing };
  });
}

/** `progress` 為線性進度 0–1（會被夾住並套 easeOutCubic）；`1` 即終點，可給減少動態效果直接使用。 */
export function busFrame(tweens: BusTween[], progress: number): AnimatedBus[] {
  const eased = easeOutCubic(Math.max(0, Math.min(1, progress)));
  return tweens.map((tw) => ({
    ...tw.bus,
    lat: tw.fromLat + (tw.toLat - tw.fromLat) * eased,
    lng: tw.fromLng + (tw.toLng - tw.fromLng) * eased,
    bearing: tw.bearing,
  }));
}
