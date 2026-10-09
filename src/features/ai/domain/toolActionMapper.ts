// 移植自 Web `src/lib/ai/toolActionMapper.ts`（commit f5027af）。`any`／裸斷言改 `unknown` + type guard；marker 標題的預設字串需要 `t`。
import { a11yPlacesToMarkers, googlePlacesToMarkers } from './aiResults';
import type { Translate } from './types';
import type { UIAction } from './uiAction';
import { parseAiRoutePlan } from './routePlan';

export function mapToolToActions(toolName: string, result: unknown, _args: unknown, t: Translate): UIAction[] {
  switch (toolName) {
    case 'findA11yPlaces':
      return [{ type: 'show-markers', markers: a11yPlacesToMarkers(result, t) }];

    case 'findGooglePlaces':
      return [{ type: 'show-markers', markers: googlePlacesToMarkers(result, t) }];

    case 'plan_route':
    case 'planAccessibleRoute':
      return mapRouteResult(result);

    default:
      return [];
  }
}

function mapRouteResult(result: unknown): UIAction[] {
  const plan = parseAiRoutePlan(result);
  return plan ? [{ type: 'show-route', origin: plan.origin, destination: plan.destination, routes: plan.routes, plan }] : [{ type: 'route-error' }];
}
