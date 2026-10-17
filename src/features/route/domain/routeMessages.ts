import type { RouteMessageDetail } from '../types/route';

export type RouteMessageTone = 'caution' | 'positive' | 'neutral';

// Presentation only: these codes never change routing/accessibility decisions.
const CAUTION_CODES = new Set([
  'ROUTE_DATA_SPARSE', 'ROUTE_LONG_WALK', 'ROUTE_MANY_TRANSFERS', 'ROUTE_ADVERSE_ENVIRONMENT',
  'ROUTE_NO_ACCESSIBLE_TOILET', 'ROUTE_STAIRS_HANDRAIL_UNKNOWN',
  'ROUTE_SLOPE_CSR', 'ROUTE_SLOPE_NO_ELEVATION', 'ROUTE_SLOPE_SERVER_DEFAULT',
  'ROUTE_SLOPE_WHEELCHAIR_DISABLED', 'ROUTE_SLOPE_SERVER_LIMIT',
  'ROUTE_STAIRS_CONSTRAINT_UNSATISFIED', 'ROUTE_HAZARD_DATA_UNAVAILABLE', 'ROUTE_HAZARD_ON_ROUTE',
  'ROUTE_CLOSURE_BYPASS_FAILED', 'ROUTE_HAZARD_ALL_ROUTES_BLOCKED', 'ROUTE_CSR_APPROXIMATE_INDOOR',
  'ROUTE_PARK_NO_QUALIFYING_ENTRANCE', 'ROUTE_HIGH_FLOOR_ALTERNATIVE',
  'ROUTE_HIGH_FLOOR_NO_ALTERNATIVE', 'ROUTE_WALK_CONNECTOR_UNAVAILABLE',
]);
const POSITIVE_CODES = new Set([
  'ROUTE_TOILET_AVAILABLE', 'ROUTE_NEARBY_ACCESS_FEATURES', 'ROUTE_WALK_NEARBY_FEATURES',
  'ROUTE_BOARD_ELEVATOR_NEARBY', 'ROUTE_ALIGHT_ELEVATOR_NEARBY',
  'ROUTE_BOARD_RAMP_NEARBY', 'ROUTE_ALIGHT_RAMP_NEARBY', 'ROUTE_ACCESSIBLE_TOILET_NEARBY',
  'ROUTE_TACTILE_PAVING_NEARBY', 'ROUTE_AUDIO_SIGNAL_NEARBY', 'ROUTE_BOARD_FACILITIES',
  'ROUTE_ALIGHT_FACILITIES', 'ROUTE_LOW_FLOOR_DIRECT', 'ROUTE_LOW_FLOOR_ALL', 'ROUTE_LOW_FLOOR_EVIDENCE',
]);

export interface RouteMessage {
  index: number;
  text: string;
  tone: RouteMessageTone;
}

/** Bind before sorting: duplicate indices and mismatched messages are not trustworthy metadata.
 * Always retain every original string (including duplicates and external source text).
 */
export function pairRouteMessages(
  messages: readonly string[] = [],
  details?: readonly RouteMessageDetail[],
): RouteMessage[] {
  const byIndex = new Map<number, RouteMessageDetail | null>();
  if (Array.isArray(details)) {
    for (const detail of details) {
      if (!detail || !Number.isInteger(detail.index) || detail.index < 0 || detail.index >= messages.length) continue;
      byIndex.set(detail.index, byIndex.has(detail.index) ? null : detail);
    }
  }
  return messages.map((text, index) => {
    const detail = byIndex.get(index);
    const code = detail?.message === text ? detail.code : undefined;
    const tone = code && CAUTION_CODES.has(code) ? 'caution'
      : code && POSITIVE_CODES.has(code) ? 'positive' : 'neutral';
    return { index, text, tone };
  });
}

export function orderRouteHighlights(messages: readonly string[], details?: readonly RouteMessageDetail[]): RouteMessage[] {
  return pairRouteMessages(messages, details).sort((a, b) =>
    Number(b.tone === 'caution') - Number(a.tone === 'caution') || a.index - b.index);
}
