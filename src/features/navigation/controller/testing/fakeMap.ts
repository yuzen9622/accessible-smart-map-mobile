// 僅供 navigation 測試：`@/features/map` 的替身。
//
// 使用者位置用**真實**的 map store（`store/userLocationStore.ts` 只 import 型別，不會把原生模組或 route 帶進來，
// 也不會造成 jest.mock 工廠的循環 require）；只有地圖相機換成空實作。
import type { useUserLocationStore as UserLocationStore } from '@/features/map';
import { PINNED_FACILITY_CATEGORIES } from '@/features/map/domain/facilities';

const { useUserLocationStore } = jest.requireActual<{ useUserLocationStore: typeof UserLocationStore }>(
  '@/features/map/store/userLocationStore',
);

export const fakeUserLocationStore = useUserLocationStore;

export const mapModule = {
  mapCamera: { fitBounds: () => {}, flyTo: () => {}, easeTo: () => {} },
  // sheet 永遠露出：面板導向立刻執行。
  sheetNavigation: { whenVisible: (navigate: () => void) => navigate() },
  useUserLocationStore,
  // 純常數，沒有原生模組依賴，直接用真的（route store 的 facilityFilter 初始值會展開它）。
  PINNED_FACILITY_CATEGORIES,
};

export function resetFakeMap(): void {
  useUserLocationStore.setState({ position: null, heading: null, course: null, navigationAccuracy: false });
}
