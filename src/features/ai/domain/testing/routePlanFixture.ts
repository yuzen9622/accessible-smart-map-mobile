import type { AiRoutePlan, BusLeg } from '@/features/route/domain';
import { venueHandoffFixture } from '@/features/route/domain/testing/venueHandoffFixture';

export function routePlanFixture(): Extract<AiRoutePlan, { journeyKind?: 'outdoor' }> {
  const leg: BusLeg = {
    type: 'BUS', routeName: '99', departureStop: '起站', arrivalStop: '台中火車站',
    polyline: [[120, 24], [120.1, 24.1]], direction: 0,
    waitInfo: { time: null, source: 'unavailable' }, estimatedWaitMinutes: 0,
    departureStopA11y: [], arrivalStopA11y: [],
  };
  return {
    journeyKind: 'outdoor', routeContractVersion: 1, ok: true, planId: 'plan-a', selectedRouteId: 'bus-b', city: 'Taichung',
    origin: { name: '起站', lat: 24, lng: 120 }, destination: { name: '台中火車站', lat: 24.1, lng: 120.1 },
    routes: ['bus-a', 'bus-b'].map((routeId) => ({ routeId, navigationId: `nav-${routeId}`, routeVersion: 1, routeToken: `token-${routeId}`, routeName: routeId, totalMinutes: 15, transferCount: 0, accessibilityHighlights: [], legs: [{ ...leg }] })),
    effectivePreferences: { mode: 'wheelchair', travelMode: 'transit', transitPreference: 'bus', maxTransfers: 2, avoidStairs: true, requireElevator: true, departureTime: '2026-10-10T08:00:00+08:00' },
  };
}

export function indoorRoutePlanFixture(): Extract<AiRoutePlan, { journeyKind: 'indoor' }> {
  const { leg } = venueHandoffFixture();
  const base = routePlanFixture();
  const from = leg.path.coordinates[0];
  const to = leg.path.coordinates[leg.path.coordinates.length - 1];
  return { ...base, journeyKind: 'indoor', selectedRouteId: 'indoor-route',
    origin: { name: '校門', lat: from[1], lng: from[0] }, destination: { name: '會議室', lat: to[1], lng: to[0] },
    originVenuePlace: { venueId: leg.venueId, placeId: leg.fromPlaceId, sourceVersion: leg.venueVersion, buildingId: null, levelRef: null },
    destinationVenuePlace: { venueId: leg.venueId, placeId: leg.toPlaceId, sourceVersion: leg.venueVersion, buildingId: 'building', levelRef: '1F' },
    routes: [{ ...base.routes[0], routeId: 'indoor-route', legs: [] }], indoorRoute: leg,
    effectivePreferences: { mode: leg.mode, travelMode: 'walk', transitPreference: 'none', maxTransfers: 0, avoidStairs: true, requireElevator: false },
  };
}

export function mixedRoutePlanFixture(): Extract<AiRoutePlan, { journeyKind: 'mixed' }> {
  const { arrival, leg, destinationName } = venueHandoffFixture();
  const base = routePlanFixture();
  return { ...base, journeyKind: 'mixed', destination: { ...base.destination, name: destinationName },
    destinationVenuePlace: { venueId: arrival.venueId, placeId: arrival.placeId, sourceVersion: arrival.venueVersion, buildingId: 'building', levelRef: '1F' },
    venueArrival: arrival, venueLeg: leg,
  };
}
