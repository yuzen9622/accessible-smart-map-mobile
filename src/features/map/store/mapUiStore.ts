import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createPersistStorage } from '@/shared/storage';

interface MapUiState {
  /** 使用者偏好的 2D/3D（跨重啟保留） */
  is3d: boolean;
  /** sheet 目前遮住的地圖底部高度（pt），由 root layout 依 detent 更新 */
  sheetInset: number;
  toggle3d: () => void;
  setSheetInset: (inset: number) => void;
}

export const useMapUiStore = create<MapUiState>()(
  persist(
    (set) => ({
      is3d: false,
      sheetInset: 0,
      toggle3d: () => set((state) => ({ is3d: !state.is3d })),
      setSheetInset: (sheetInset) => set({ sheetInset }),
    }),
    {
      name: 'map.ui',
      storage: createPersistStorage<Pick<MapUiState, 'is3d'>>(),
      partialize: (state) => ({ is3d: state.is3d }),
    },
  ),
);
