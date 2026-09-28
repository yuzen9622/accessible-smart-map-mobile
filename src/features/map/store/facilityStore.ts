import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createPersistStorage } from '@/shared/storage';

import { PINNED_FACILITY_CATEGORIES, type Facility, type PinnedFacilityCategory } from '../domain/facilities';

interface FacilityState {
  /** null = 尚未載入（與「載入完但是空的」[] 區分，對齊 Web A11yPanel.tsx:202-207） */
  facilities: Facility[] | null;
  loadError: string | null;
  /** 地圖上要顯示的類別；預設空（對齊 Web），使用者選擇會跨重啟保留 */
  selected: PinnedFacilityCategory[];
  setFacilities: (facilities: Facility[]) => void;
  setLoadError: (error: string | null) => void;
  toggleCategory: (category: PinnedFacilityCategory) => void;
  setSelected: (selected: PinnedFacilityCategory[]) => void;
}

function isPinnedCategory(value: string): value is PinnedFacilityCategory {
  return (PINNED_FACILITY_CATEGORIES as readonly string[]).includes(value);
}

export const useFacilityStore = create<FacilityState>()(
  persist(
    (set) => ({
      facilities: null,
      loadError: null,
      selected: [],
      setFacilities: (facilities) => set({ facilities, loadError: null }),
      setLoadError: (loadError) => set({ loadError }),
      setSelected: (selected) => set({ selected }),
      toggleCategory: (category) =>
        set((state) => ({
          selected: state.selected.includes(category)
            ? state.selected.filter((item) => item !== category)
            : [...state.selected, category],
        })),
    }),
    {
      name: 'map.facilities',
      storage: createPersistStorage<Pick<FacilityState, 'selected'>>(),
      partialize: (state) => ({ selected: state.selected }),
      merge: (persisted, current) => {
        const selected =
          typeof persisted === 'object' && persisted !== null && 'selected' in persisted && Array.isArray(persisted.selected)
            ? persisted.selected.filter((item): item is PinnedFacilityCategory => typeof item === 'string' && isPinnedCategory(item))
            : current.selected;
        return { ...current, selected };
      },
    },
  ),
);

/**
 * 對齊 Web OnboardingFlow applyDefaultFacilityFilter：只在地圖篩選仍是空的時候套用預設類別，
 * 使用者已經自己開過篩選就不覆蓋（不在背後替人開關）。
 */
export function applyDefaultFacilityCategories(categories: PinnedFacilityCategory[]): boolean {
  const { selected, setSelected } = useFacilityStore.getState();
  if (selected.length > 0 || categories.length === 0) return false;
  setSelected(categories);
  return true;
}
