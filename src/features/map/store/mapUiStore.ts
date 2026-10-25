import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createPersistStorage } from '@/shared/storage';
import type { LngLat, LngLatBounds } from '@maplibre/maplibre-react-native';

/** 原生追蹤模式（maplibre Camera `trackUserLocation`）：導航時由 navigation 經 `mapCamera.follow` 開啟。 */
export type MapFollowMode = 'heading' | 'course';

export interface MapFollowState {
  mode: MapFollowMode;
  zoom: number;
  pitch: number;
}

interface MapUiState {
  /** 使用者偏好的 2D/3D（跨重啟保留） */
  is3d: boolean;
  /** sheet 目前遮住的地圖底部高度（pt），由 root layout 依 detent 更新 */
  sheetInset: number;
  /** sheet 目前落在第幾個 detent（使用者拖曳由 root layout 更新；程式切換由 `sheetController` 更新）。 */
  sheetDetentIndex: number;
  /** 地圖目前縮放等級（相機停下時更新，非持久化）；距離 pill 標記依此決定是否顯示。 */
  zoom: number;
  /** 地圖目前可視範圍（相機停下時更新，非持久化）。 */
  bounds: LngLatBounds | null;
  /** 地圖目前中心點（相機停下時更新，非持久化）；「回到搜尋點」浮動鈕依此跟目標 pin 算距離。 */
  center: LngLat | null;
  /**
   * 最近一次地圖移動是不是使用者手勢拖出來的（程式呼叫 `mapCamera.flyTo` 之類的自動置中是 false）。
   * 「回到搜尋點」浮動鈕靠這個欄位分辨「剛搜尋完程式自動飛過去」跟「使用者自己把地圖滑開」——
   * 兩者都會讓 pin 離開畫面，但只有後者才該顯示按鈕（使用者回饋 2026-10-25：一搜尋完按鈕就冒出來）。
   */
  lastRegionChangeWasUserInteraction: boolean;
  /** 相機正在跟隨使用者（非持久化）。 */
  follow: MapFollowState | null;
  /** 使用者拖曳地圖打斷了跟隨（native 追蹤自動解除）；由呼叫端決定是否顯示「回到導航」。 */
  followInterrupted: boolean;
  toggle3d: () => void;
  setSheetInset: (inset: number) => void;
  setSheetDetentIndex: (index: number) => void;
  setZoom: (zoom: number) => void;
  /** 地圖相機停下來時一次性更新範圍／中心點／這次移動是不是使用者手勢，三個值要一起變才不會互相不同步。 */
  setRegion: (bounds: LngLatBounds, center: LngLat, userInteraction: boolean) => void;
  setFollow: (follow: MapFollowState | null) => void;
  setFollowInterrupted: (interrupted: boolean) => void;
}

export const useMapUiStore = create<MapUiState>()(
  persist(
    (set) => ({
      is3d: false,
      sheetInset: 0,
      sheetDetentIndex: 0,
      zoom: 0,
      bounds: null,
      center: null,
      lastRegionChangeWasUserInteraction: false,
      follow: null,
      followInterrupted: false,
      toggle3d: () => set((state) => ({ is3d: !state.is3d })),
      setSheetInset: (sheetInset) => set({ sheetInset }),
      setSheetDetentIndex: (sheetDetentIndex) => set({ sheetDetentIndex }),
      setZoom: (zoom) => set({ zoom }),
      setRegion: (bounds, center, userInteraction) => set({ bounds, center, lastRegionChangeWasUserInteraction: userInteraction }),
      setFollow: (follow) => set({ follow, followInterrupted: false }),
      setFollowInterrupted: (followInterrupted) => set({ followInterrupted }),
    }),
    {
      name: 'map.ui',
      storage: createPersistStorage<Pick<MapUiState, 'is3d'>>(),
      partialize: (state) => ({ is3d: state.is3d }),
    },
  ),
);
