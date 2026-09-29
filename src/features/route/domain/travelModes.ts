// 移植自 Web `src/components/BottomSheet/RoutePlanContent.tsx`（commit 5eadc71）的模式常數與閘控規則。

import type { RouteMode, TravelMode } from '../types/route';

export const TRAVEL_MODES: readonly TravelMode[] = ['transit', 'drive', 'motorcycle', 'walk'];
export const ROUTE_MODES: readonly RouteMode[] = ['normal', 'wheelchair', 'elderly', 'visual_impaired'];

export const ROUTE_MODE_LABEL_KEY: Record<RouteMode, string> = {
  normal: 'normalMode',
  wheelchair: 'wheelchairMode',
  elderly: 'elderlyMode',
  visual_impaired: 'visualImpairedMode',
};

/** 輪椅與視障模式不適用開車／機車（Web `DISALLOWED_TRAVEL_MODES`）。 */
const DISALLOWED_TRAVEL_MODES: Partial<Record<RouteMode, readonly TravelMode[]>> = {
  wheelchair: ['drive', 'motorcycle'],
  visual_impaired: ['drive', 'motorcycle'],
};

export function isTravelModeAllowed(routeMode: RouteMode, travelMode: TravelMode): boolean {
  return !(DISALLOWED_TRAVEL_MODES[routeMode] ?? []).includes(travelMode);
}

/** 目前的交通方式被新的無障礙模式停用時，自動退回大眾運輸（Web 行為）。 */
export function effectiveTravelMode(routeMode: RouteMode, travelMode: TravelMode): TravelMode {
  return isTravelModeAllowed(routeMode, travelMode) ? travelMode : 'transit';
}

export function hasGatedTravelModes(routeMode: RouteMode): boolean {
  return (DISALLOWED_TRAVEL_MODES[routeMode]?.length ?? 0) > 0;
}
