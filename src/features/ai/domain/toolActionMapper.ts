// 移植自 Web `src/lib/ai/toolActionMapper.ts`（commit f5027af）。`any`／裸斷言改 `unknown` + type guard；marker 標題的預設字串需要 `t`。
import { a11yPlacesToMarkers, googlePlacesToMarkers, isOk, isRec } from './aiResults';
import type { Translate } from './types';
import type { AiMarker, UIAction } from './uiAction';
import { isRouteTool, parseAiRoutePlan } from './routePlan';
import { backendErrorText } from './backendError';
import { getToolResultGroup } from './toolResultCards';

export function mapToolToActions(toolName: string, result: unknown, _args: unknown, t: Translate): UIAction[] {
  if (!isOk(result) && !isRouteTool(toolName)) return [];
  switch (toolName) {
    case 'findA11yPlaces':
    case 'findGooglePlaces': {
      const markers = toolName === 'findA11yPlaces' ? a11yPlacesToMarkers(result, t) : googlePlacesToMarkers(result, t);
      return markers.length ? [{ type: 'show-markers', markers }] : [];
    }

    case 'findNearbyParking':
    case 'findNearbyBusStops':
    case 'trackBuses':
    case 'findCampusAccessibility':
    case 'getCampusAccessibilityDetails':
    case 'getA11yFacilityDetails':
    case 'getNearbyHazards': {
      const group = getToolResultGroup(toolName, result, t);
      const markers: AiMarker[] = group?.items.flatMap((item) => item.position ? [{
        id: item.id, title: item.title, subtitle: item.subtitle, position: item.position, kind: 'facility' as const,
      }] : []) ?? [];
      return markers.length ? [{ type: 'show-markers', markers }] : [];
    }

    // 只有文字助理的結果帶 clientAction；語音助理已由後端 `ui.command` 直接執行。
    case 'startNavigation':
      return isRec(result) && result.clientAction === 'start-navigation'
        ? [{ type: 'start-navigation', ...(typeof result.routeId === 'string' ? { routeId: result.routeId } : {}) }]
        : [];
    case 'stopNavigation':
      return isRec(result) && result.clientAction === 'stop-navigation' ? [{ type: 'stop-navigation' }] : [];

    case 'plan_route':
    case 'planAccessibleRoute':
    case 'planIndoorRoute':
      return mapRouteResult(result, t);

    default:
      return [];
  }
}

function mapRouteResult(result: unknown, t: Translate): UIAction[] {
  const plan = isOk(result) ? parseAiRoutePlan(result) : null;
  if (plan) return [{ type: 'show-route', origin: plan.origin, destination: plan.destination, routes: plan.routes, plan }];
  // Tool failures are NOT HTTP envelopes: reason/error belong to result itself.
  const message = isRec(result) ? backendErrorText(
    typeof result.reason === 'string' ? result.reason : undefined,
    typeof result.error === 'string' ? result.error : undefined,
    t,
  ) : undefined;
  return [{ type: 'route-error', ...(message ? { message } : {}) }];
}
