import type { VenueRoute } from '@/shared/venue';
import { parseVenueRoute } from '@/shared/venue/parseVenueRoute';

import type { EffectiveRoutePreferences, RouteMode, VenueArrival, VenueDestination } from '../types/route';
import type { RouteFailureKind } from './routeRequest';

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const version = (value: unknown): value is number => number(value) && Number.isSafeInteger(value) && value >= 1;

export function parseVenueDestination(value: unknown): VenueDestination & { sourceVersion: number } {
  if (!record(value) || !text(value.venueId) || !text(value.placeId) || !version(value.sourceVersion) ||
      (value.buildingId != null && !text(value.buildingId)) || (value.levelRef != null && !text(value.levelRef))) {
    throw new Error('INVALID_VENUE_ENDPOINT');
  }
  return { venueId: value.venueId, placeId: value.placeId, sourceVersion: value.sourceVersion,
    ...(value.buildingId === null || text(value.buildingId) ? { buildingId: value.buildingId } : {}),
    ...(value.levelRef === null || text(value.levelRef) ? { levelRef: value.levelRef } : {}),
  };
}

export function parseVenueFields(value: Record<string, unknown>): { venueArrival?: VenueArrival; venueLeg?: VenueRoute } {
  if (value.venueArrival === undefined && value.venueLeg === undefined) return {};
  const raw = value.venueArrival;
  if (!record(raw) || !text(raw.venueId) || !text(raw.placeId) || !text(raw.gateId) ||
      !record(raw.gateLocation) || !number(raw.gateLocation.lat) || !number(raw.gateLocation.lng) ||
      Math.abs(raw.gateLocation.lat) > 90 || Math.abs(raw.gateLocation.lng) > 180 || !version(raw.venueVersion) ||
      (raw.mode !== 'normal' && raw.mode !== 'wheelchair' && raw.mode !== 'elderly' && raw.mode !== 'visual_impaired')) {
    throw new Error('INVALID_VENUE_ARRIVAL');
  }
  const venueArrival: VenueArrival = {
    venueId: raw.venueId, placeId: raw.placeId, gateId: raw.gateId,
    gateLocation: { lat: raw.gateLocation.lat, lng: raw.gateLocation.lng },
    mode: raw.mode, venueVersion: raw.venueVersion,
  };
  const venueLeg = parseVenueRoute(value.venueLeg, {
    venueId: venueArrival.venueId, fromPlaceId: venueArrival.gateId,
    toPlaceId: venueArrival.placeId, mode: venueArrival.mode,
  });
  if (venueLeg.venueVersion !== venueArrival.venueVersion) throw new Error('VENUE_VERSION_MISMATCH');
  return { venueArrival, venueLeg };
}

function matchesAuthoredLocation(endpoint: VenueDestination, route: VenueRoute, index: number): boolean {
  return (endpoint.buildingId === undefined || endpoint.buildingId === route.path.buildingIds[index]) &&
    (endpoint.levelRef === undefined || endpoint.levelRef === route.path.levelRefs[index]);
}

export function indoorRouteFailure(route: VenueRoute, input: {
  originVenuePlace?: VenueDestination;
  destinationVenuePlace?: VenueDestination;
  mode?: RouteMode;
  avoidStairs?: boolean;
  requireElevator?: boolean;
  canonicalPreferences?: EffectiveRoutePreferences;
}): RouteFailureKind | null {
  const { originVenuePlace: origin, destinationVenuePlace: destination } = input;
  if (!origin || !destination || origin.venueId !== route.venueId || destination.venueId !== route.venueId ||
      origin.placeId !== route.fromPlaceId || destination.placeId !== route.toPlaceId ||
      (input.mode !== undefined && input.mode !== route.mode)) return 'failed';
  if ([origin, destination].some((place) => place.sourceVersion !== undefined && place.sourceVersion !== route.venueVersion)) return 'stale-venue';
  if (!matchesAuthoredLocation(origin, route, 0) || !matchesAuthoredLocation(destination, route, route.path.coordinates.length - 1)) return 'failed';
  if ((input.avoidStairs || input.requireElevator || input.canonicalPreferences?.avoidStairs || input.canonicalPreferences?.requireElevator) &&
      route.steps.some((step) => step.type === 'stairs' || step.type === 'steps' || step.type === 'escalator')) return 'no-accessible-route';
  return null;
}

export function venueArrivalFailure(destination: VenueDestination | undefined, arrival: VenueArrival | undefined,
  leg: VenueRoute | undefined, mode?: RouteMode): RouteFailureKind | null {
  if (!destination) return null;
  if (!arrival || !leg || arrival.venueId !== destination.venueId || arrival.placeId !== destination.placeId ||
      leg.venueId !== destination.venueId || leg.toPlaceId !== destination.placeId || leg.fromPlaceId !== arrival.gateId ||
      arrival.mode !== leg.mode || (mode !== undefined && leg.mode !== mode)) return 'failed';
  if (arrival.venueVersion !== leg.venueVersion ||
      (destination.sourceVersion !== undefined && leg.venueVersion !== destination.sourceVersion)) return 'stale-venue';
  if (!matchesAuthoredLocation(destination, leg, leg.path.coordinates.length - 1)) return 'failed';
  return null;
}
