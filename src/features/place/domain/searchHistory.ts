import { placeKey } from './placeKey';
import type { PlaceDetail } from '../types/place';

/**
 * 移植自 Web `src/stores/map/createSearchSlice.ts`（commit 5eadc71）的搜尋
 * 歷史規則。Web 版把這些規則寫死在 zustand action 裡；本檔把純判斷抽成可測的
 * 函式，store 只負責呼叫與持久化。
 *
 * 戶外依顯示名稱去重；室內保留場館／地點身分，避免合併不同樓層的同名房間。
 */
export function placeDisplayName(entry: PlaceDetail): string {
  if (entry.kind === 'venue-place') return entry.name;
  return entry.kind === 'place' ? entry.place.name || entry.place.fullAddress || '' : entry.address;
}

// 室內同名房間可能在不同建物／樓層；其歷史使用圖節點身分，戶外保留既有名稱去重。
function historyIdentity(entry: PlaceDetail): string {
  return entry.kind === 'venue-place' ? placeKey(entry) : `name:${placeDisplayName(entry)}`;
}

export function hasDisplayName(entry: PlaceDetail): boolean {
  return placeDisplayName(entry).trim().length > 0;
}

/** 載入時濾掉空白名稱，並依歷史身分去重，保留先出現者。 */
export function sanitizeSearchHistory(history: readonly PlaceDetail[]): PlaceDetail[] {
  const seen = new Set<string>();
  const result: PlaceDetail[] = [];
  for (const entry of history) {
    if (!hasDisplayName(entry)) continue;
    const name = historyIdentity(entry);
    if (seen.has(name)) continue;
    seen.add(name);
    result.push(entry);
  }
  return result;
}

export const SEARCH_HISTORY_MAX = 10;

/**
 * `addSearchHistory`：把 `next` 加到最前面，移除相同身分的舊紀錄，並把長度
 * 上限鎖在 10（`[next, ...deduped.slice(0, 9)]`，逐字對齊 Web 版）。
 * 名稱為空白時整個操作是 no-op（回傳原陣列的淺拷貝）。
 */
export function addToSearchHistory(history: readonly PlaceDetail[], next: PlaceDetail): PlaceDetail[] {
  if (!hasDisplayName(next)) return [...history];
  const name = historyIdentity(next);
  const deduped = history.filter((entry) => historyIdentity(entry) !== name);
  return [next, ...deduped.slice(0, SEARCH_HISTORY_MAX - 1)];
}

/** 刪除單筆搜尋紀錄，與新增時使用相同身分。 */
export function removeSearchHistoryEntry(history: readonly PlaceDetail[], target: PlaceDetail): PlaceDetail[] {
  const name = historyIdentity(target);
  return history.filter((entry) => historyIdentity(entry) !== name);
}

/** `initSavedPlaces`：同樣濾掉空白名稱，但**不**去重（收藏允許同名不同地點）。 */
export function sanitizeSavedPlaces(places: readonly PlaceDetail[]): PlaceDetail[] {
  return places.filter(hasDisplayName);
}

/** `addSavedPlace`：名稱為空或 key 已存在時 no-op；否則前插。 */
export function addSavedPlaceEntry(
  places: readonly PlaceDetail[],
  next: PlaceDetail,
): { places: PlaceDetail[]; added: boolean } {
  if (!hasDisplayName(next)) return { places: [...places], added: false };
  const key = placeKey(next);
  if (places.some((p) => placeKey(p) === key)) return { places: [...places], added: false };
  return { places: [next, ...places], added: true };
}

export function removeSavedPlaceEntry(
  places: readonly PlaceDetail[],
  target: PlaceDetail,
): { places: PlaceDetail[]; removed: boolean } {
  const key = placeKey(target);
  const removed = places.some((p) => placeKey(p) === key);
  return { places: places.filter((p) => placeKey(p) !== key), removed };
}
