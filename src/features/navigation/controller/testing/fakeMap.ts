// 僅供 navigation 測試：`@/features/map` 的替身。
//
// 使用者位置用**真實**的 map store（`store/userLocationStore.ts` 只 import 型別，不會把原生模組或 route 帶進來，
// 也不會造成 jest.mock 工廠的循環 require）；只有地圖相機換成空實作。
import type { useUserLocationStore as UserLocationStore } from '@/features/map';

const { useUserLocationStore } = jest.requireActual<{ useUserLocationStore: typeof UserLocationStore }>(
  '@/features/map/store/userLocationStore',
);

export const fakeUserLocationStore = useUserLocationStore;

export const mapModule = {
  mapCamera: { fitBounds: () => {}, flyTo: () => {}, easeTo: () => {} },
  useUserLocationStore,
};

export function resetFakeMap(): void {
  useUserLocationStore.setState({ position: null, heading: null, course: null, navigationAccuracy: false });
}
