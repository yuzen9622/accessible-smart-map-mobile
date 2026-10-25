import type { LngLatBounds } from '@maplibre/maplibre-react-native';

/** 經緯度座標是否落在地圖目前可視範圍內（含邊界）；跨國際換日線的情況目前沒有地圖使用情境，不處理。 */
export function boundsContain(bounds: LngLatBounds, point: { lat: number; lng: number }): boolean {
  const [west, south, east, north] = bounds;
  return point.lng >= west && point.lng <= east && point.lat >= south && point.lat <= north;
}
