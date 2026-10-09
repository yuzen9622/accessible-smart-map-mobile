import { getRouteSessionSnapshot, replaceNavigationRoute } from '@/features/route';
import type { AccessibleRoute, AccessibleRouteRerouteData, NavInstruction } from '@/features/route/domain';

import type { NavRerouteReason } from '../domain/types';
import { useNavStore } from '../store/navStore';

/**
 * 移植自 Web `src/lib/navigation/rerouteCoordinator.ts`（commit 5eadc71），版本比對與套用順序逐行保留。
 * 差異：Web 直接寫 `useMapStore` 的 `selectRoute`／`computeRoutes`；本版經 route 公開的
 * `replaceNavigationRoute` 換路線（route session 已結束時它會拒絕，不會把 session 復活）。
 */

export interface RouteReplacement {
  navigationId: string;
  previousRouteVersion: number;
  routeVersion: number;
  routeToken: string;
  route: AccessibleRoute;
  instructions: NavInstruction[];
  warnings: string[];
  currentStepIndex: 0;
  reason?: NavRerouteReason;
}

export type VoiceRerouteCoordinatorEvent =
  | {
      type: 'nav.rerouting';
      navigationId: string;
      previousRouteVersion: number;
      reason?: NavRerouteReason;
    }
  | { type: 'nav.route_replaced'; replacement: RouteReplacement }
  | {
      type: 'nav.reroute_failed';
      navigationId: string;
      previousRouteVersion: number;
      message: string;
      retryable: boolean;
    };

export function normalizeRerouteReplacement(
  data: AccessibleRouteRerouteData,
): RouteReplacement {
  return {
    navigationId: data.navigationId,
    previousRouteVersion: data.previousRouteVersion,
    routeVersion: data.routeVersion,
    routeToken: data.routeToken,
    route: data.route,
    instructions: data.instructions ?? data.steps,
    warnings: data.warnings,
    currentStepIndex: data.currentStepIndex,
  };
}

/**
 * Applies a complete replacement synchronously at one seam. A stale response
 * changes neither the selected route nor the navigation runtime.
 */
export function applyRouteReplacement(replacement: RouteReplacement): boolean {
  const nav = useNavStore.getState();
  const currentRoute = getRouteSessionSnapshot().navigationRoute?.route;
  const currentNavigationId = currentRoute?.navigationId ?? null;
  const currentVersion = currentRoute?.routeVersion ?? 0;
  if (
    nav.arrived ||
    !currentNavigationId ||
    replacement.navigationId !== currentNavigationId ||
    replacement.previousRouteVersion !== currentVersion ||
    replacement.routeVersion !== currentVersion + 1 ||
    nav.navigationId !== currentNavigationId ||
    nav.routeVersion !== currentVersion
  ) {
    return false;
  }

  const route: AccessibleRoute = {
    ...replacement.route,
    navigationId: replacement.navigationId,
    routeVersion: replacement.routeVersion,
    routeToken: replacement.routeToken,
    warnings: replacement.warnings,
  };
  const totalM = replacement.instructions.reduce(
    (sum, instruction) => sum + (instruction.distanceM ?? 0),
    0,
  );

  if (!replaceNavigationRoute(route)) return false;
  useNavStore.setState({
    navigationId: replacement.navigationId,
    routeVersion: replacement.routeVersion,
    instructions: replacement.instructions,
    warnings: replacement.warnings,
    currentStepIndex: 0,
    distanceToNextM: replacement.instructions[0]?.distanceM ?? null,
    remainingM: totalM || null,
    remainingDurationSec: null,
    estimatedArrivalAt: null,
    etaSource: null,
    etaUpdatedAt: null,
    routeTotalM: totalM || null,
    isOffRoute: false,
    arrived: false,
    rerouteStatus: 'idle',
    rerouteError: null,
    rerouteRetryable: false,
  });
  nav.setLastRerouteReason(replacement.reason ?? null);
  nav.clearAdvisories();
  return true;
}

export function handleVoiceRerouteEvent(
  event: VoiceRerouteCoordinatorEvent,
): boolean | null {
  const nav = useNavStore.getState();
  const currentRoute = getRouteSessionSnapshot().navigationRoute?.route;
  const currentNavigationId = currentRoute?.navigationId ?? null;
  const currentVersion = currentRoute?.routeVersion ?? 0;
  const matchesCurrentVoiceRoute =
    !nav.arrived &&
    nav.navigationSource === 'voice' &&
    currentNavigationId !== null &&
    nav.navigationId === currentNavigationId &&
    nav.routeVersion === currentVersion;

  switch (event.type) {
    case 'nav.rerouting':
      if (
        !matchesCurrentVoiceRoute ||
        event.navigationId !== currentNavigationId ||
        event.previousRouteVersion !== currentVersion
      ) {
        return false;
      }
      nav.setReroutePending();
      nav.setLastRerouteReason(event.reason ?? null);
      return null;
    case 'nav.route_replaced':
      if (
        !matchesCurrentVoiceRoute ||
        event.replacement.navigationId !== currentNavigationId ||
        event.replacement.routeVersion !== currentVersion + 1
      ) {
        return false;
      }
      return applyRouteReplacement(event.replacement);
    case 'nav.reroute_failed':
      if (
        !matchesCurrentVoiceRoute ||
        event.navigationId !== currentNavigationId ||
        event.previousRouteVersion !== currentVersion
      ) {
        return false;
      }
      nav.setRerouteError(event.message, event.retryable);
      return null;
  }
}
