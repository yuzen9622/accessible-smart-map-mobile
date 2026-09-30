import { PINNED_FACILITY_CATEGORIES, type PinnedFacilityCategory } from '../domain/facilities';
import { buildNearbyItems } from '../domain/nearby';
import { useFacilityStore } from '../store/facilityStore';
import { useUserLocationStore } from '../store/userLocationStore';

/** 首頁一句話摘要的範圍：輪椅／慢行約 80 m/分 × 5 分鐘。 */
export const NEARBY_SUMMARY_RADIUS_M = 400;

export type NearbySummary = Record<PinnedFacilityCategory, number>;

/**
 * 使用者附近 5 分鐘步程內各類無障礙設施的數量（不受地圖圖層開關影響）。
 * 沒有位置或設施尚未載入時回傳 null，由呼叫端決定不顯示。
 */
export function useNearbySummary(): NearbySummary | null {
  const position = useUserLocationStore((state) => state.position);
  const facilities = useFacilityStore((state) => state.facilities);
  if (!position || !facilities) return null;
  const counts: NearbySummary = { elevator: 0, ramp: 0, toilet: 0 };
  for (const item of buildNearbyItems(position, facilities, [], new Set(PINNED_FACILITY_CATEGORIES))) {
    if (item.kind === 'facility' && item.distance <= NEARBY_SUMMARY_RADIUS_M) counts[item.facility.category] += 1;
  }
  return counts;
}
