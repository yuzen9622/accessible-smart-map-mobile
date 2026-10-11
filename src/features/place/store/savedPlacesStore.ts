import { create } from 'zustand';

import { appStorage } from '@/shared/storage';

import { addSavedPlaceEntry, addToSearchHistory, removeSavedPlaceEntry, removeSearchHistoryEntry } from '../domain/searchHistory';
import { isBuiltInSavedPlaceCategory, placeKey, type SavedPlaceCategory } from '../domain/placeKey';
import {
  loadPersistedPlaceState,
  persistSavedCustomCategories,
  persistSavedPlaceCategories,
  persistSavedPlaces,
  persistSearchHistory,
} from './persistence';
import type { PlaceDetail } from '../types/place';

/**
 * 持久化 store（MMKV），對齊 Web `createSearchSlice.ts`（commit 5eadc71）的
 * 搜尋歷史／收藏地點／自訂分類語意。啟動時的搬遷見 `persistence.ts`。
 *
 * 差異：不用 zustand `persist` middleware——Web 版三個 key 直接對應
 * `localStorage` 的三個獨立 key，用 `persist` middleware 會把它們包進一個
 * JSON 信封、換掉 key 名稱，導致 `commitVersionedWrite`／`readJson` 的
 * 搬遷語意對不上；改成 store 初始化時呼叫 `loadPersistedPlaceState` 讀取，
 * 每個 mutation action 呼叫時同步寫回對應的 key（與 Web 版逐一
 * `localStorage.setItem` 的寫入時機一致）。
 */

interface SavedPlacesState {
  searchHistory: PlaceDetail[];
  savedPlaces: PlaceDetail[];
  savedPlaceCategories: Record<string, string>;
  /** 使用者自建的收藏分類標籤（像 Google 地圖「建立新清單」），依建立順序。 */
  customCategories: string[];
  addSearchHistory: (entry: PlaceDetail) => void;
  removeSearchHistory: (entry: PlaceDetail) => void;
  clearSearchHistory: () => void;
  addSavedPlace: (entry: PlaceDetail) => void;
  removeSavedPlace: (entry: PlaceDetail) => void;
  clearSavedPlaces: () => void;
  setSavedPlaceCategory: (entry: PlaceDetail, category: SavedPlaceCategory | null) => void;
  /** 新增一個自訂分類；名稱重複（含內建分類）或空字串會被忽略，回傳是否真的新增了。 */
  addCustomCategory: (name: string) => boolean;
  /** 重新命名一個自訂分類，連同所有已套用這個分類的地點一起改名。 */
  renameCustomCategory: (oldName: string, newName: string) => boolean;
  /** 刪除一個自訂分類；套用這個分類的地點會變回「未分類」，不會被連帶刪除收藏。 */
  removeCustomCategory: (name: string) => void;
}

const initial = loadPersistedPlaceState(appStorage);

export const useSavedPlacesStore = create<SavedPlacesState>()((set, get) => ({
  searchHistory: initial.searchHistory,
  savedPlaces: initial.savedPlaces,
  savedPlaceCategories: initial.savedPlaceCategories,
  customCategories: initial.savedCustomCategories,

  addSearchHistory: (entry) => {
    const next = addToSearchHistory(get().searchHistory, entry);
    persistSearchHistory(appStorage, next);
    set({ searchHistory: next });
  },
  removeSearchHistory: (entry) => {
    const next = removeSearchHistoryEntry(get().searchHistory, entry);
    persistSearchHistory(appStorage, next);
    set({ searchHistory: next });
  },
  clearSearchHistory: () => {
    persistSearchHistory(appStorage, []);
    set({ searchHistory: [] });
  },
  addSavedPlace: (entry) => {
    const { places, added } = addSavedPlaceEntry(get().savedPlaces, entry);
    if (!added) return;
    persistSavedPlaces(appStorage, places);
    set({ savedPlaces: places });
  },
  removeSavedPlace: (entry) => {
    const { savedPlaces, savedPlaceCategories } = get();
    const { places, removed } = removeSavedPlaceEntry(savedPlaces, entry);
    if (!removed) return;
    const nextCategories = { ...savedPlaceCategories };
    delete nextCategories[placeKey(entry)];
    persistSavedPlaces(appStorage, places);
    persistSavedPlaceCategories(appStorage, nextCategories);
    set({ savedPlaces: places, savedPlaceCategories: nextCategories });
  },
  clearSavedPlaces: () => {
    persistSavedPlaces(appStorage, []);
    persistSavedPlaceCategories(appStorage, {});
    set({ savedPlaces: [], savedPlaceCategories: {} });
  },
  setSavedPlaceCategory: (entry, category) => {
    const key = placeKey(entry);
    const next = { ...get().savedPlaceCategories };
    if (category) next[key] = category;
    else delete next[key];
    persistSavedPlaceCategories(appStorage, next);
    set({ savedPlaceCategories: next });
  },
  addCustomCategory: (name) => {
    const trimmed = name.trim();
    const { customCategories } = get();
    if (!trimmed || isBuiltInSavedPlaceCategory(trimmed) || customCategories.includes(trimmed)) return false;
    const next = [...customCategories, trimmed];
    persistSavedCustomCategories(appStorage, next);
    set({ customCategories: next });
    return true;
  },
  renameCustomCategory: (oldName, newName) => {
    const trimmed = newName.trim();
    const { customCategories, savedPlaceCategories } = get();
    if (!trimmed || !customCategories.includes(oldName)) return false;
    if (trimmed !== oldName && (isBuiltInSavedPlaceCategory(trimmed) || customCategories.includes(trimmed))) return false;
    const nextCategories = customCategories.map((name) => (name === oldName ? trimmed : name));
    const nextPlaceCategories = Object.fromEntries(
      Object.entries(savedPlaceCategories).map(([key, value]) => [key, value === oldName ? trimmed : value]),
    );
    persistSavedCustomCategories(appStorage, nextCategories);
    persistSavedPlaceCategories(appStorage, nextPlaceCategories);
    set({ customCategories: nextCategories, savedPlaceCategories: nextPlaceCategories });
    return true;
  },
  removeCustomCategory: (name) => {
    const { customCategories, savedPlaceCategories } = get();
    const nextCategories = customCategories.filter((c) => c !== name);
    const nextPlaceCategories = { ...savedPlaceCategories };
    for (const key of Object.keys(nextPlaceCategories)) {
      if (nextPlaceCategories[key] === name) delete nextPlaceCategories[key];
    }
    persistSavedCustomCategories(appStorage, nextCategories);
    persistSavedPlaceCategories(appStorage, nextPlaceCategories);
    set({ customCategories: nextCategories, savedPlaceCategories: nextPlaceCategories });
  },
}));

export function isSavedPlace(savedPlaces: PlaceDetail[], entry: PlaceDetail): boolean {
  const key = placeKey(entry);
  return savedPlaces.some((p) => placeKey(p) === key);
}
