import type { PlaceDetail } from '../types/place';

/**
 * 移植自 Web `src/stores/map/types.ts:240-260`（commit 5eadc71）。
 * `placeKey` 逐行搬移；**必守不變量**（Phase brief §6）：用的是目前的
 * 前綴 id（如 `osm:node:123`），不是遷移前的舊 `place_id` 數字——格式一改，
 * `savedPlaceCategories` 的對應就會失效，這正是 `migrateLegacyPlaceStorage`
 * 要修的問題。
 */
export function placeKey(p: PlaceDetail): string {
  return p.kind === 'place' ? `p_${p.place.id}` : `c_${p.position.lat}_${p.position.lng}`;
}

export const SAVED_PLACE_CATEGORIES = ['favorite', 'food', 'transport', 'medical', 'other'] as const;
export type SavedPlaceCategory = (typeof SAVED_PLACE_CATEGORIES)[number];

export function isSavedPlaceCategory(value: unknown): value is SavedPlaceCategory {
  return typeof value === 'string' && (SAVED_PLACE_CATEGORIES as readonly string[]).includes(value);
}
