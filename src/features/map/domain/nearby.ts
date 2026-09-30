// 對齊 Web A11yPanel.tsx:89-133 的 nearbyItems：設施＋停車依距離排序，2 km 內取前 10 筆。
import { haversineMeters, type LatLng } from '@/shared/geo';

import type { Facility, PinnedFacilityCategory } from './facilities';
import { parkingItemLngLat, type ParkingNearbyItem } from './parking';

export const NEARBY_RADIUS_M = 2000;
export const NEARBY_LIMIT = 10;

export type NearbyItem =
  | { kind: 'facility'; id: string; distance: number; position: LatLng; facility: Facility }
  | { kind: 'parking'; id: string; distance: number; position: LatLng; parking: ParkingNearbyItem };

/**
 * selected 為空時列出全部類別（清單是地圖的無障礙替代路徑，不應因為地圖沒開任何圖層就變空）；
 * 有選取時只列選取的設施類別。停車一律列出。
 */
export function buildNearbyItems(
  origin: LatLng,
  facilities: readonly Facility[],
  parking: readonly ParkingNearbyItem[],
  selected: ReadonlySet<PinnedFacilityCategory>,
): NearbyItem[] {
  const items: NearbyItem[] = [];
  for (const facility of facilities) {
    if (selected.size > 0 && !selected.has(facility.category)) continue;
    const position = { lat: facility.lat, lng: facility.lng };
    const distance = haversineMeters(origin, position);
    if (distance < NEARBY_RADIUS_M) items.push({ kind: 'facility', id: facility.id, distance, position, facility });
  }
  for (const item of parking) {
    const position = parkingItemLngLat(item);
    if (!position) continue;
    const distance = haversineMeters(origin, position);
    if (distance < NEARBY_RADIUS_M) items.push({ kind: 'parking', id: item._id, distance, position, parking: item });
  }
  return items.sort((a, b) => a.distance - b.distance).slice(0, NEARBY_LIMIT);
}

/** 設施清單的分類篩選（設計 2a 的 segmented control）。 */
export type NearbyFilter = 'all' | PinnedFacilityCategory | 'parking';

/** 依篩選列出附近項目：「全部」含停車；選設施類別時只列該類別；選停車時只列停車。 */
export function buildFilteredNearbyItems(
  origin: LatLng,
  facilities: readonly Facility[],
  parking: readonly ParkingNearbyItem[],
  filter: NearbyFilter,
): NearbyItem[] {
  if (filter === 'all') return buildNearbyItems(origin, facilities, parking, new Set());
  if (filter === 'parking') return buildNearbyItems(origin, [], parking, new Set());
  return buildNearbyItems(origin, facilities, [], new Set([filter]));
}

/** 半徑內各類別的數量（不受 {@link NEARBY_LIMIT} 限制），給分類標籤顯示「電梯 3」。 */
export function countNearby(
  origin: LatLng,
  facilities: readonly Facility[],
  parking: readonly ParkingNearbyItem[],
): Record<PinnedFacilityCategory | 'parking', number> {
  const counts: Record<PinnedFacilityCategory | 'parking', number> = { elevator: 0, ramp: 0, toilet: 0, parking: 0 };
  for (const facility of facilities) {
    if (haversineMeters(origin, { lat: facility.lat, lng: facility.lng }) < NEARBY_RADIUS_M) counts[facility.category] += 1;
  }
  for (const item of parking) {
    const position = parkingItemLngLat(item);
    if (position && haversineMeters(origin, position) < NEARBY_RADIUS_M) counts.parking += 1;
  }
  return counts;
}
