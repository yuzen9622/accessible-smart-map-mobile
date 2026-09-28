import { create } from 'zustand';

import type { PlaceDetail } from '../types/place';

/**
 * 非持久化 store：目前搜尋結果／目前選定的地點 pin（對齊 Web `useMapStore`
 * 的 `searchPlace` 欄位，但拆出 place feature 自己擁有，不進 god store）。
 * `PlacePinLayer` 讀 `selectedPlace` 畫 pin；`ExplorePanel` 選到結果後
 * 呼叫 `setSelectedPlace` 並 `mapCamera.flyTo`。
 */
interface PlaceUiState {
  selectedPlace: PlaceDetail | null;
  setSelectedPlace: (place: PlaceDetail | null) => void;
}

export const usePlaceUiStore = create<PlaceUiState>()((set) => ({
  selectedPlace: null,
  setSelectedPlace: (selectedPlace) => set({ selectedPlace }),
}));
