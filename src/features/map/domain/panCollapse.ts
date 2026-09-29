import type { LngLat, LngLatBounds } from '@maplibre/maplibre-react-native';

/** 手勢開始時與進行中的相機狀態（MapLibre `ViewStateChangeEvent` 的子集）。 */
export interface ViewportSample {
  center: LngLat;
  zoom: number;
  bounds: LngLatBounds;
}

/** 平移超過可視範圍的這個比例就收合 sheet（約四分之一個畫面，對齊 Apple 地圖的手感）。 */
export const PAN_COLLAPSE_FRACTION = 0.25;
/** 縮放超過這麼多級也算「大幅移動」。 */
export const ZOOM_COLLAPSE_DELTA = 1;

/**
 * 使用者拖動地圖的幅度是否大到該把 sheet 收到最小（Apple 地圖：往地圖探索時卡片讓位）。
 * 以手勢開始時的可視範圍當尺度，所以不論縮放層級，都是「拖過畫面的幾分之幾」。
 */
export function shouldCollapseForPan(start: ViewportSample, current: ViewportSample): boolean {
  if (Math.abs(current.zoom - start.zoom) >= ZOOM_COLLAPSE_DELTA) return true;
  const [west, south, east, north] = start.bounds;
  const width = Math.abs(east - west);
  const height = Math.abs(north - south);
  if (width === 0 || height === 0) return false;
  const dx = Math.abs(current.center[0] - start.center[0]) / width;
  const dy = Math.abs(current.center[1] - start.center[1]) / height;
  return Math.max(dx, dy) >= PAN_COLLAPSE_FRACTION;
}
