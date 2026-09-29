import { create } from 'zustand';

/** 面板正在顯示的站牌（路線詳情的站序、站牌搜尋／附近清單），供地圖 `BusStopLayer` 繪製。 */
export interface PanelStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface BusPanelState {
  displayedStops: PanelStop[];
  selectedStopId: string | null;
  setDisplayedStops: (stops: PanelStop[]) => void;
  selectStop: (id: string | null) => void;
  clear: () => void;
}

export const useBusPanelStore = create<BusPanelState>()((set) => ({
  displayedStops: [],
  selectedStopId: null,
  setDisplayedStops: (displayedStops) => set({ displayedStops }),
  selectStop: (selectedStopId) => set({ selectedStopId }),
  clear: () => set({ displayedStops: [], selectedStopId: null }),
}));
