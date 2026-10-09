import { getRouteSessionSnapshot, subscribeRouteSession } from '@/features/route';
import {
  buildCumulativePath,
  resolveWaypoints,
  type AccessibleRoute,
  type CumulativePath,
  type NavInstruction,
  type Waypoint,
} from '@/features/route/domain';

import { useNavStore } from '../store/navStore';

/**
 * 移植自 Web `src/lib/navigation/navigationGeometryRuntime.ts`（commit 5eadc71），同步規則逐行保留；
 * 差異只在訂閱來源：選中路線改經 route 公開的 `subscribeRouteSession`（Web 訂閱 `useMapStore`）。
 */
export interface NavigationGeometryRuntime {
  path: CumulativePath | null;
  waypoints: Waypoint[];
}

export function createNavigationGeometryRuntime(): NavigationGeometryRuntime {
  return { path: null, waypoints: [] };
}

export function replaceNavigationGeometryRuntime(
  runtime: NavigationGeometryRuntime,
  route: AccessibleRoute,
  instructions: NavInstruction[],
): void {
  const path = buildCumulativePath(route.legs);
  runtime.path = path;
  runtime.waypoints = resolveWaypoints(instructions, path);
}

/**
 * 讓本機投影引擎跟上 store 的整組替換。zustand 訂閱是同步的，所以替換呼叫回傳前新路徑就已經裝好，
 * 不依賴 instructions 請求的時機。
 */
export function observeLocalNavigationGeometry(runtime: NavigationGeometryRuntime): () => void {
  const sync = () => {
    const route = getRouteSessionSnapshot().navigationRoute?.route;
    const nav = useNavStore.getState();
    if (nav.navigationSource === 'voice') {
      runtime.path = null;
      runtime.waypoints = [];
      return;
    }
    if (!route?.navigationId || nav.navigationId !== route.navigationId || nav.routeVersion !== (route.routeVersion ?? 0)) {
      runtime.path = null;
      runtime.waypoints = [];
      return;
    }
    replaceNavigationGeometryRuntime(runtime, route, nav.instructions);
  };

  sync();
  const unsubscribeRoute = subscribeRouteSession((state, previous) => {
    if (state.navigationRoute?.route !== previous.navigationRoute?.route) sync();
  });
  const unsubscribeNav = useNavStore.subscribe((state, previous) => {
    if (
      state.navigationSource !== previous.navigationSource ||
      state.navigationId !== previous.navigationId ||
      state.routeVersion !== previous.routeVersion ||
      state.instructions !== previous.instructions
    ) {
      sync();
    }
  });
  return () => {
    unsubscribeRoute();
    unsubscribeNav();
  };
}
