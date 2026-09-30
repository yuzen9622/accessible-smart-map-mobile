import { usePathname } from 'expo-router';

import { buildNearbyItems, type NearbyItem } from '../domain/nearby';
import { useFacilityStore } from '../store/facilityStore';
import { useMapUiStore } from '../store/mapUiStore';
import { useUserLocationStore } from '../store/userLocationStore';

/** 首頁地圖上帶距離的設施 pill（設計 1b）：只標最近的幾個，其餘仍是圓點圖層。 */
const PILL_LIMIT = 8;
const PILL_RADIUS_M = 500;
/** 縮得比街區還遠時 pill 會互相重疊，退回圓點＋cluster */
const PILL_MIN_ZOOM = 15;

export type FacilityPill = Extract<NearbyItem, { kind: 'facility' }>;

/**
 * 首頁（`/explore`）且縮放夠近時，回傳使用者附近、已開啟類別中最近的設施；
 * `FacilityLayer` 會把這些設施從圓點圖層排除，避免同一點畫兩次。
 */
export function useFacilityPills(): FacilityPill[] {
  const position = useUserLocationStore((state) => state.position);
  const facilities = useFacilityStore((state) => state.facilities);
  const selected = useFacilityStore((state) => state.selected);
  const zoom = useMapUiStore((state) => state.zoom);
  const pathname = usePathname();
  if (!position || !facilities || selected.length === 0 || zoom < PILL_MIN_ZOOM || pathname !== '/explore') return [];
  return buildNearbyItems(position, facilities, [], new Set(selected))
    .filter((item): item is FacilityPill => item.kind === 'facility' && item.distance <= PILL_RADIUS_M)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, PILL_LIMIT);
}
