// 移植自 Web `src/lib/ai/toolActionMapper.ts`（commit f5027af）。`any`／裸斷言改 `unknown` + type guard；marker 標題的預設字串需要 `t`。
import { a11yPlacesToMarkers, googlePlacesToMarkers, isRec } from './aiResults';
import type { Translate } from './types';
import type { UIAction } from './uiAction';
import type { AccessibleRoute } from '@/features/route/domain';
import type { LatLng } from '@/shared/geo';

export function mapToolToActions(toolName: string, result: unknown, args: unknown, t: Translate): UIAction[] {
  switch (toolName) {
    case 'findA11yPlaces':
      return [{ type: 'show-markers', markers: a11yPlacesToMarkers(result, t) }];

    case 'findGooglePlaces':
      return [{ type: 'show-markers', markers: googlePlacesToMarkers(result, t) }];

    case 'plan_route':
    case 'planAccessibleRoute':
      return mapRouteResult(result, args);

    default:
      return [];
  }
}

function extractLatLng(primary: unknown, fallback: unknown): LatLng | null {
  for (const src of [primary, fallback]) {
    if (!isRec(src)) continue;
    const lat = src.lat ?? src.latitude;
    const lng = src.lng ?? src.longitude;
    if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }
  return null;
}

function parseArgs(args: unknown): Record<string, unknown> {
  if (typeof args === 'string') {
    try {
      const parsed: unknown = JSON.parse(args || '{}');
      return isRec(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return isRec(args) ? args : {};
}

/** 後端 `routes` 是路線陣列；這裡只驗「是物件陣列」，細部欄位由 UI 端存取時再防禦。 */
function isRouteList(v: unknown): v is AccessibleRoute[] {
  return Array.isArray(v) && v.every(isRec);
}

function hasDrawableLeg(route: unknown): boolean {
  if (!isRec(route) || !Array.isArray(route.legs)) return false;
  return route.legs.some((leg: unknown) => isRec(leg) && Array.isArray(leg.polyline) && leg.polyline.length > 0);
}

function mapRouteResult(result: unknown, args: unknown): UIAction[] {
  const res = isRec(result) ? result : {};
  const parsed = parseArgs(args);

  const origin = extractLatLng(res.origin, parsed.origin);
  const destination = extractLatLng(res.destination, parsed.destination);

  const aiRoutes = isRouteList(res.routes) ? res.routes : null;
  const drawable = !!aiRoutes && aiRoutes.length > 0 && aiRoutes.some(hasDrawableLeg);

  const actions: UIAction[] = [];

  if (aiRoutes && drawable && origin && destination) {
    actions.push({ type: 'show-route', origin, destination, routes: aiRoutes });
    actions.push({ type: 'switch-panel', sheet: 'route' });
  } else if (origin && destination) {
    actions.push({ type: 'compute-route', origin, destination });
    actions.push({ type: 'switch-panel', sheet: 'route' });
  } else if (aiRoutes && aiRoutes.length > 0) {
    actions.push({
      type: 'show-route',
      origin: extractLatLng(res.origin, null) ?? { lat: 0, lng: 0 },
      destination: extractLatLng(res.destination, null) ?? { lat: 0, lng: 0 },
      routes: aiRoutes,
    });
    actions.push({ type: 'switch-panel', sheet: 'route' });
  }

  return actions;
}
