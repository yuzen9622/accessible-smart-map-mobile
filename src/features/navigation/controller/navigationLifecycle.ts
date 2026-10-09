import { getRouteSessionSnapshot, pinNavigationRoute, clearNavigationRoute } from '@/features/route';

import { useNavStore } from '../store/navStore';
import { localRerouteCoordinator } from './localRerouteCoordinator';

/**
 * 移植自 Web `src/lib/navigation/navigationLifecycle.ts`（commit 5eadc71），順序逐行保留：
 * 先同步開一個新的重算 session，再切到導航中；結束時先 abort 進行中的重算，再清 store。
 */
export function startNavigation(): boolean {
  if (!pinNavigationRoute()) return false;
  const nav = useNavStore.getState();
  const navigationId = getRouteSessionSnapshot().navigationRoute?.route.navigationId ?? null;
  nav.setNavigationIdentity(navigationId, getRouteSessionSnapshot().navigationRoute?.route.routeVersion ?? 0);
  localRerouteCoordinator.startSession(navigationId);
  nav.setIsNavigating(true);
  return true;
}

export function stopNavigation(): void {
  localRerouteCoordinator.stopSession();
  const nav = useNavStore.getState();
  nav.setIsNavigating(false);
  nav.reset();
  clearNavigationRoute();
}
