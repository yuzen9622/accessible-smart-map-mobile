import { create } from 'zustand';

import type { ParkingNearbyItem } from '../domain/parking';

interface ParkingState {
  /** null = 尚未查詢 */
  items: ParkingNearbyItem[] | null;
  setItems: (items: ParkingNearbyItem[]) => void;
}

export const useParkingStore = create<ParkingState>()((set) => ({
  items: null,
  setItems: (items) => set({ items }),
}));
