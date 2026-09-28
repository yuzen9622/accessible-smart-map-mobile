import { appStorage, commitVersionedWrite, readJson, type KeyValueStorage } from '@/shared/storage';

import { migrateLegacyPlaceStorage } from '../domain/adapters';
import { sanitizeSavedPlaces, sanitizeSearchHistory } from '../domain/searchHistory';
import type { PlaceDetail } from '../types/place';

/**
 * 對齊 Web `client-layout.tsx`（commit 5eadc71）在每次啟動時做的搬遷：
 * `searchHistory`／`savedPlaces`／`savedPlaceCategories` 三個 key 原樣沿用，
 * `placeSchemaVersion === "2"` 代表已是目前格式（`PlaceDetail`／`PlaceResult`），
 * 否則視為舊格式並呼叫 `migrateLegacyPlaceStorage`；一次性搬遷寫入用
 * `commitVersionedWrite`（全部寫完才寫版本號，失敗整組回滾）。
 *
 * 這是本 App 第一版，目前沒有「更舊」的資料源，但 §7.3／brief 要求把
 * Web 的搬遷語意原樣保留，讓未來 schema 再變動時（bump 到 "3"）有現成的
 * 一次性搬遷骨架可用，且邏輯已有測試覆蓋。
 */

export const SEARCH_HISTORY_KEY = 'searchHistory';
export const SAVED_PLACES_KEY = 'savedPlaces';
export const SAVED_CATEGORIES_KEY = 'savedPlaceCategories';
export const PLACE_SCHEMA_VERSION_KEY = 'placeSchemaVersion';
export const PLACE_SCHEMA_VERSION = '2';

export interface PersistedPlaceState {
  searchHistory: PlaceDetail[];
  savedPlaces: PlaceDetail[];
  savedPlaceCategories: Record<string, string>;
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value as Record<string, unknown>).every((v) => typeof v === 'string');
}

function isPlaceDetailArray(value: unknown): value is PlaceDetail[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      if (typeof entry !== 'object' || entry === null) return false;
      const kind = (entry as { kind?: unknown }).kind;
      return kind === 'place' || kind === 'coordinate';
    })
  );
}

/** 讀取＋（必要時）搬遷本機儲存的地點資料。同步、供 store 在模組載入時呼叫一次。 */
export function loadPersistedPlaceState(storage: KeyValueStorage = appStorage): PersistedPlaceState {
  const currentVersion = storage.getString(PLACE_SCHEMA_VERSION_KEY);

  if (currentVersion === PLACE_SCHEMA_VERSION) {
    return {
      searchHistory: sanitizeSearchHistory(readJson(storage, SEARCH_HISTORY_KEY, isPlaceDetailArray, [])),
      savedPlaces: sanitizeSavedPlaces(readJson(storage, SAVED_PLACES_KEY, isPlaceDetailArray, [])),
      savedPlaceCategories: readJson(storage, SAVED_CATEGORIES_KEY, isStringRecord, {}),
    };
  }

  const legacySearchHistory = readJson(storage, SEARCH_HISTORY_KEY, isUnknownArray, []);
  const legacySavedPlaces = readJson(storage, SAVED_PLACES_KEY, isUnknownArray, []);
  const legacySavedPlaceCategories = readJson(
    storage,
    SAVED_CATEGORIES_KEY,
    (v): v is Record<string, unknown> => typeof v === 'object' && v !== null,
    {},
  );

  const migrated = migrateLegacyPlaceStorage({
    searchHistory: legacySearchHistory,
    savedPlaces: legacySavedPlaces,
    savedPlaceCategories: legacySavedPlaceCategories,
  });

  try {
    commitVersionedWrite(storage, {
      entries: {
        [SEARCH_HISTORY_KEY]: JSON.stringify(migrated.searchHistory),
        [SAVED_PLACES_KEY]: JSON.stringify(migrated.savedPlaces),
        [SAVED_CATEGORIES_KEY]: JSON.stringify(migrated.savedPlaceCategories),
      },
      versionKey: PLACE_SCHEMA_VERSION_KEY,
      version: PLACE_SCHEMA_VERSION,
    });
  } catch {
    // 寫入失敗時 commitVersionedWrite 已回滾；版本號不會被推進，下次啟動會重試搬遷。
  }

  return {
    searchHistory: sanitizeSearchHistory(migrated.searchHistory),
    savedPlaces: sanitizeSavedPlaces(migrated.savedPlaces),
    savedPlaceCategories: migrated.savedPlaceCategories,
  };
}

export function persistSearchHistory(storage: KeyValueStorage, history: PlaceDetail[]): void {
  storage.set(SEARCH_HISTORY_KEY, JSON.stringify(history));
}

export function persistSavedPlaces(storage: KeyValueStorage, places: PlaceDetail[]): void {
  storage.set(SAVED_PLACES_KEY, JSON.stringify(places));
}

export function persistSavedPlaceCategories(storage: KeyValueStorage, categories: Record<string, string>): void {
  storage.set(SAVED_CATEGORIES_KEY, JSON.stringify(categories));
}
