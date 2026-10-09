import type { AiRoutePlan, AccessibleRoute, EffectiveRoutePreferences } from '@/features/route/domain';
import { isRec } from './aiResults';

export const isRouteTool = (name: string): boolean => name === 'plan_route' || name === 'planAccessibleRoute';
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const strings = (v: unknown): boolean => Array.isArray(v) && v.every((x) => typeof x === 'string');
function endpoint(v: unknown): boolean {
  return isRec(v) && typeof v.name === 'string' && number(v.lat) && Math.abs(v.lat) <= 90 && number(v.lng) && Math.abs(v.lng) <= 180;
}
function preferences(v: unknown): v is EffectiveRoutePreferences {
  return isRec(v) && ['normal', 'wheelchair', 'elderly', 'visual_impaired'].includes(String(v.mode)) &&
    ['walk', 'transit', 'drive', 'motorcycle'].includes(String(v.travelMode)) &&
    ['none', 'bus', 'rail', 'metro'].includes(String(v.transitPreference)) &&
    number(v.maxTransfers) && Number.isInteger(v.maxTransfers) && v.maxTransfers >= 0 &&
    typeof v.avoidStairs === 'boolean' && typeof v.requireElevator === 'boolean' &&
    (v.departureTime === undefined || (typeof v.departureTime === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(v.departureTime) && Number.isFinite(Date.parse(v.departureTime))));
}
function routeShape(v: unknown): v is AccessibleRoute {
  if (!isRec(v) || !text(v.routeId) || typeof v.routeName !== 'string' || !number(v.totalMinutes) || !number(v.transferCount) ||
      !strings(v.accessibilityHighlights) || (v.warnings !== undefined && !strings(v.warnings)) ||
      (v.routeToken !== undefined && (!text(v.routeToken) || v.routeToken.trim().length > 256)) ||
      !Array.isArray(v.legs) || !v.legs.length) return false;
  return v.legs.every((leg) => isRec(leg) && ['WALK', 'BUS', 'METRO', 'TRA', 'THSR', 'DRIVE', 'MOTORCYCLE'].includes(String(leg.type)) &&
    (leg.type === 'BUS' ? typeof leg.departureStop === 'string' && typeof leg.arrivalStop === 'string' && typeof leg.routeName === 'string' :
      ['METRO', 'TRA', 'THSR'].includes(String(leg.type)) ? typeof leg.departureStation === 'string' && typeof leg.arrivalStation === 'string' :
      typeof leg.from === 'string' && typeof leg.to === 'string') &&
    (leg.polyline == null || (Array.isArray(leg.polyline) && leg.polyline.every((p) => Array.isArray(p) && p.length === 2 && number(p[0]) && Math.abs(p[0]) <= 180 && number(p[1]) && Math.abs(p[1]) <= 90))));
}

/** The versioned boundary validates every candidate; geometry is optional, identity is not. */
export function parseAiRoutePlan(value: unknown): AiRoutePlan | null {
  if (!isRec(value) || value.routeContractVersion !== 1 || value.ok !== true || !text(value.planId) || !text(value.selectedRouteId) ||
      !endpoint(value.origin) || !endpoint(value.destination) || !preferences(value.effectivePreferences) ||
      !Array.isArray(value.routes) || !value.routes.length || !value.routes.every(routeShape)) return null;
  const ids = new Set(value.routes.map((route) => route.routeId));
  if (ids.size !== value.routes.length || !ids.has(value.selectedRouteId)) return null;
  // Only the transport boundary asserts the remaining optional backend metadata.
  return { ...value, routes: value.routes.map((route) => ({ ...route, legs: route.legs.map((leg) => ({ ...leg, polyline: leg.polyline ?? [] })) })) } as unknown as AiRoutePlan;
}
