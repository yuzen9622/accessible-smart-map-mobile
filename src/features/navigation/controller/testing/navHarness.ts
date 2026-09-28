// 僅供 navigation controller 測試使用（不在 index.ts 匯出）。
//
// Web 的導航測試直接 `useMapStore.setState({ isNavigating, userLocation, selectRoute, computeRoutes })`。
// 本 App 這些欄位分屬 navigation（isNavigating）、map（使用者位置）、route（選中路線）三個 feature。
// 這裡提供與 Web 同形狀的 `useMapStore` 轉接層：路線經**真實**的 route 公開 API 寫入
// （`applyComputedRoutes`／`endRouteSession`），讀取用 `getRouteSessionSnapshot`——測試跑的是真的
// route store，不是一份複製的邏輯。只有 map（相機、使用者位置）以 `fakeMap.ts` 替身取代。
import { applyComputedRoutes, endRouteSession, getRouteSessionSnapshot } from '@/features/route';
import type { AccessibleRoute } from '@/features/route/domain';
import type { LatLng } from '@/shared/geo';

import { useNavStore } from '../../store/navStore';
import { fakeUserLocationStore, resetFakeMap } from './fakeMap';

interface WebMapShape {
  selectRoute: { index: number; route: AccessibleRoute } | null;
  computeRoutes: AccessibleRoute[] | null;
  isNavigating: boolean;
  userLocation: LatLng | null;
}

export const useMapStore = {
  getState(): WebMapShape {
    const { selectRoute, computeRoutes } = getRouteSessionSnapshot();
    return {
      selectRoute,
      computeRoutes,
      isNavigating: useNavStore.getState().isNavigating,
      userLocation: fakeUserLocationStore.getState().position,
    };
  },
  setState(partial: Partial<WebMapShape>): void {
    const { isNavigating, userLocation, selectRoute, computeRoutes } = partial;
    if (isNavigating !== undefined) useNavStore.setState({ isNavigating });
    if (userLocation !== undefined) fakeUserLocationStore.setState({ position: userLocation });
    if (selectRoute === null) {
      endRouteSession();
    } else if (selectRoute) {
      if (selectRoute.index !== 0) throw new Error('navHarness: 只支援 index 0（真實 applyComputedRoutes 一律選第一條）');
      applyComputedRoutes(null, null, computeRoutes ?? [selectRoute.route]);
    }
  },
};

export function resetNavHarness(): void {
  endRouteSession();
  resetFakeMap();
  useNavStore.getState().reset();
  useNavStore.setState({ isNavigating: false });
}
