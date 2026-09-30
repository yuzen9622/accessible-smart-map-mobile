import { create } from 'zustand';

import type { AiMarker } from '../domain/uiAction';

interface AiResultState {
  /** AI 工具結果畫在地圖上的點（對應 Web `useMapStore.aiResultMarkers`）。 */
  markers: AiMarker[];
  setMarkers: (markers: AiMarker[]) => void;
  clear: () => void;
}

export const useAiResultStore = create<AiResultState>((set) => ({
  markers: [],
  setMarkers: (markers) => set({ markers }),
  clear: () => set({ markers: [] }),
}));
