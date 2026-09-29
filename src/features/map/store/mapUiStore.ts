import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createPersistStorage } from '@/shared/storage';

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
  /** 相機正在跟隨使用者（非持久化）。 */
  follow: MapFollowState | null;
  /** 使用者拖曳地圖打斷了跟隨（native 追蹤自動解除）；由呼叫端決定是否顯示「回到導航」。 */
  followInterrupted: boolean;
  toggle3d: () => void;
  setSheetInset: (inset: number) => void;
  setSheetDetentIndex: (index: number) => void;
  setFollow: (follow: MapFollowState | null) => void;
  setFollowInterrupted: (interrupted: boolean) => void;
}

export const useMapUiStore = create<MapUiState>()(
  persist(
    (set) => ({
      is3d: false,
      sheetInset: 0,
      sheetDetentIndex: 0,
      follow: null,
      followInterrupted: false,
      toggle3d: () => set((state) => ({ is3d: !state.is3d })),
      setSheetInset: (sheetInset) => set({ sheetInset }),
      setSheetDetentIndex: (sheetDetentIndex) => set({ sheetDetentIndex }),
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
