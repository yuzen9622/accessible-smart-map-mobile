import { create } from 'zustand';

import type { EnvironmentInfo } from '../domain/environment';

interface EnvironmentState {
  /** null = 尚未查詢 */
  info: EnvironmentInfo | null;
  setInfo: (info: EnvironmentInfo) => void;
}

export const useEnvironmentStore = create<EnvironmentState>()((set) => ({
  info: null,
  setInfo: (info) => set({ info }),
}));
