import type { NearbyFacilityBrief, PlaceResult } from '../types/place';

export interface NearbyFacilityRow {
  key: string;
  name: string;
  address: string | null;
  typeLabel: string;
  distanceText: string;
  /** 來源清單：`toilets` → 無障礙廁所、`metro` → 捷運無障礙設施（多為電梯），供列表挑類別色與圖示 */
  kind: 'toilet' | 'metro';
}

export const NEARBY_FACILITY_ROW_LIMIT = 5;

function isBrief(value: unknown): value is NearbyFacilityBrief {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && typeof row.name === 'string' &&
    typeof row.category === 'string' && typeof row.typeLabel === 'string' &&
    typeof row.distanceMeters === 'number' && Number.isFinite(row.distanceMeters) &&
    (row.address === null || typeof row.address === 'string');
}

/**
 * 地點自帶的附近設施（`nearbyFacilities.toilets`＋`metro`）合併成依距離排序的
 * 唯讀清單。後端 `isPlaceResult` 不驗 `nearbyFacilities`，舊快取／反查結果可能
 * 缺整個物件或其中一個陣列，所以逐層以 `?? []` 防禦。
 */
export function nearbyFacilityRows(
  place: PlaceResult | null,
  formatDistance: (meters: number) => string,
): NearbyFacilityRow[] {
  // API 的 runtime guard 只驗基本欄位；舊快取可能把此欄位存成任意形狀。
  const nearby: unknown = place?.nearbyFacilities;
  if (!nearby || typeof nearby !== 'object') return [];
  const { toilets, metro } = nearby as Record<string, unknown>;
  const tagged = (list: unknown, kind: NearbyFacilityRow['kind']) =>
    (Array.isArray(list) ? list : []).filter(isBrief).map((item: NearbyFacilityBrief) => ({ item, kind }));
  const items = [...tagged(toilets, 'toilet'), ...tagged(metro, 'metro')];
  return items
    .sort((a, b) => a.item.distanceMeters - b.item.distanceMeters)
    .slice(0, NEARBY_FACILITY_ROW_LIMIT)
    .map(({ item, kind }) => ({
      key: `${item.category}-${item.id}`,
      name: item.name,
      address: item.address,
      typeLabel: item.typeLabel,
      distanceText: formatDistance(item.distanceMeters),
      kind,
    }));
}
