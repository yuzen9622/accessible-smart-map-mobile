import { create } from 'zustand';

import { appStorage } from '@/shared/storage';

import { addSavedPlaceEntry, addToSearchHistory, removeSavedPlaceEntry, removeSearchHistoryEntry } from '../domain/searchHistory';
import { placeKey, type SavedPlaceCategory } from '../domain/placeKey';
import { loadPersistedPlaceState, persistSavedPlaceCategories, persistSavedPlaces, persistSearchHistory } from './persistence';
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
  addSearchHistory: (entry: PlaceDetail) => void;
  removeSearchHistory: (entry: PlaceDetail) => void;
  clearSearchHistory: () => void;
  addSavedPlace: (entry: PlaceDetail) => void;
  removeSavedPlace: (entry: PlaceDetail) => void;
  clearSavedPlaces: () => void;
  setSavedPlaceCategory: (entry: PlaceDetail, category: SavedPlaceCategory | null) => void;
}

const initial = loadPersistedPlaceState(appStorage);

export const useSavedPlacesStore = create<SavedPlacesState>()((set, get) => ({
  searchHistory: initial.searchHistory,
  savedPlaces: initial.savedPlaces,
  savedPlaceCategories: initial.savedPlaceCategories,

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
}));

export function isSavedPlace(savedPlaces: PlaceDetail[], entry: PlaceDetail): boolean {
  const key = placeKey(entry);
  return savedPlaces.some((p) => placeKey(p) === key);
}
