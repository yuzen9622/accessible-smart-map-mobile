import type { PlaceDetail } from '../types/place';
import { venuePlaceId } from './venuePlace';

/**
 * 移植自 Web `src/stores/map/types.ts:240-260`（commit 5eadc71）。
 * `placeKey` 逐行搬移；**必守不變量**（Phase brief §6）：用的是目前的
 * 前綴 id（如 `osm:node:123`），不是遷移前的舊 `place_id` 數字——格式一改，
 * `savedPlaceCategories` 的對應就會失效，這正是 `migrateLegacyPlaceStorage`
 * 要修的問題。
 */
export function placeKey(p: PlaceDetail): string {
  if (p.kind === 'venue-place') return venuePlaceId(p);
  return p.kind === 'place' ? `p_${p.place.id}` : `c_${p.position.lat}_${p.position.lng}`;
}

/** 內建分類（有專屬圖示／顏色、固定 i18n key）。使用者也可以像 Google 地圖一樣自建清單標籤——
 * 那些是任意字串，存在 `savedPlacesStore.customCategories`，跟這份內建清單分開管理
 * （測試人員回饋 2026-10-11：收藏分類要能自己編輯）。 */
export const SAVED_PLACE_CATEGORIES = ['favorite', 'food', 'transport', 'medical', 'other'] as const;
export type BuiltInSavedPlaceCategory = (typeof SAVED_PLACE_CATEGORIES)[number];
/** 一個地點的分類值：內建分類 key，或使用者自訂清單名稱（任意非空字串）。 */
export type SavedPlaceCategory = string;

export function isBuiltInSavedPlaceCategory(value: unknown): value is BuiltInSavedPlaceCategory {
  return typeof value === 'string' && (SAVED_PLACE_CATEGORIES as readonly string[]).includes(value);
}

/** 分類顯示文字：內建分類走 i18n，自訂分類直接顯示使用者自己取的名字。 */
export function savedCategoryLabel(t: (key: string) => string, category: string): string {
  return isBuiltInSavedPlaceCategory(category) ? t(`savedCategory.${category}`) : category;
}
