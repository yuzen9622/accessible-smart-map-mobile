import { create } from 'zustand';

/** 面板正在顯示的站牌（路線詳情的站序、站牌搜尋／附近清單），供地圖 `BusStopLayer` 繪製。 */
export interface PanelStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/** 路線詳情畫在地圖上的車輛（該方向的即時位置）。 */
export interface PanelBus {
  plateNumb: string;
  lat: number;
  lng: number;
  accessible: boolean;
}

interface BusPanelState {
  displayedStops: PanelStop[];
  selectedStopId: string | null;
  /** true：`displayedStops` 是一條路線的站序，地圖要把它們連成線（路線詳情）。 */
  routeLine: boolean;
  /** 路線詳情的線形（`[lng, lat]`）：TDX 線形，沒有時是站序連線；空陣列表示不畫線。 */
  routePath: [number, number][];
  /** 使用者要上車的站（路線詳情從站牌進入時）。 */
  mineStopId: string | null;
  buses: PanelBus[];
  setDisplayedStops: (stops: PanelStop[]) => void;
  setRoutePath: (path: [number, number][]) => void;
  selectStop: (id: string | null) => void;
  setRouteOverlay: (overlay: { routeLine: boolean; mineStopId: string | null }) => void;
  setBuses: (buses: PanelBus[]) => void;
  clear: () => void;
}

export const useBusPanelStore = create<BusPanelState>()((set) => ({
  displayedStops: [],
  selectedStopId: null,
  routeLine: false,
  routePath: [],
  mineStopId: null,
  buses: [],
  setDisplayedStops: (displayedStops) => set({ displayedStops }),
  setRoutePath: (routePath) => set({ routePath }),
  selectStop: (selectedStopId) => set({ selectedStopId }),
  setRouteOverlay: ({ routeLine, mineStopId }) => set({ routeLine, mineStopId }),
  setBuses: (buses) => set({ buses }),
  clear: () =>
    set({ displayedStops: [], selectedStopId: null, routeLine: false, routePath: [], mineStopId: null, buses: [] }),
}));
