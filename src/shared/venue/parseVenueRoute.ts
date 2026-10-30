import type { VenueRoute, VenueRouteRequest, VenueRouteSegment, VenueRouteStep } from './types';
import { array, boolean, choice, integer, invalidVenueData, nonnegative, nullableText, optional, point3, record, text, version } from './validation';

function parseSegment(value: unknown, length: number): VenueRouteSegment {
  const item = record(value);
  const pathStart = integer(item.pathStart);
  const pathEnd = integer(item.pathEnd);
  if (pathStart < 0 || pathEnd < pathStart || pathEnd >= length) invalidVenueData();
  return { buildingId: nullableText(item.buildingId), levelRef: nullableText(item.levelRef), pathStart, pathEnd };
}
function parseStep(value: unknown, length: number): VenueRouteStep {
  const item = record(value);
  return {
    ...parseSegment(value, length),
    type: choice(item.type, ['depart', 'walk', 'enter', 'exit', 'elevator', 'escalator', 'stairs', 'steps', 'ramp', 'arrive']),
    instruction: text(item.instruction),
    maneuver: optional(item.maneuver, (value) => choice(value, ['left', 'right', 'uturn'])),
    distanceM: nonnegative(item.distanceM),
    durationS: nonnegative(item.durationS),
    fromLevelRef: optional(item.fromLevelRef, text),
    toLevelRef: optional(item.toLevelRef, text),
    connectionId: optional(item.connectionId, nullableText),
    heightPending: optional(item.heightPending, boolean),
  };
}

/** 共用的室內路段契約；同時供場館規劃與戶外→室內 API 邊界使用。 */
export function parseVenueRoute(value: unknown, expected?: VenueRouteRequest): VenueRoute {
  const item = record(value);
  const path = record(item.path);
  const coordinates = array(path.coordinates, point3);
  const buildingIds = array(path.buildingIds, nullableText);
  const levelRefs = array(path.levelRefs, nullableText);
  if (!coordinates.length || coordinates.length !== buildingIds.length || coordinates.length !== levelRefs.length) invalidVenueData();
  const route: VenueRoute = {
    venueId: text(item.venueId),
    venueVersion: version(item.venueVersion),
    mode: choice(item.mode, ['normal', 'wheelchair', 'elderly', 'visual_impaired']),
    fromPlaceId: text(item.fromPlaceId),
    toPlaceId: text(item.toPlaceId),
    distanceM: nonnegative(item.distanceM),
    durationS: nonnegative(item.durationS),
    elevatorRides: integer(item.elevatorRides),
    stairFlights: integer(item.stairFlights),
    path: { coordinates, buildingIds, levelRefs },
    segments: array(item.segments, (value) => parseSegment(value, coordinates.length)),
    steps: array(item.steps, (value) => parseStep(value, coordinates.length)),
  };
  if (route.elevatorRides < 0 || route.stairFlights < 0 || !route.steps.length || !route.segments.length) invalidVenueData();
  for (const parts of [route.steps, route.segments]) {
    if (parts[0].pathStart !== 0 || parts[parts.length - 1].pathEnd !== coordinates.length - 1) invalidVenueData();
    if (parts.some((part, index) => index > 0 && part.pathStart !== parts[index - 1].pathEnd)) invalidVenueData();
  }
  if (route.mode !== 'normal' && route.steps.some((step) => ['stairs', 'steps', 'escalator'].includes(step.type))) invalidVenueData();
  if (expected && (route.venueId !== expected.venueId || route.fromPlaceId !== expected.fromPlaceId || route.toPlaceId !== expected.toPlaceId || route.mode !== expected.mode)) invalidVenueData();
  return route;
}
