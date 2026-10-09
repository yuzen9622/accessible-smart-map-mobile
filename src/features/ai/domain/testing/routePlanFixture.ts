import type { AiRoutePlan, BusLeg } from '@/features/route/domain';

export function routePlanFixture(): AiRoutePlan {
  const leg: BusLeg = {
    type: 'BUS', routeName: '99', departureStop: '起站', arrivalStop: '台中火車站',
    polyline: [[120, 24], [120.1, 24.1]], direction: 0,
    waitInfo: { time: null, source: 'unavailable' }, estimatedWaitMinutes: 0,
    departureStopA11y: [], arrivalStopA11y: [],
  };
  return {
    routeContractVersion: 1, ok: true, planId: 'plan-a', selectedRouteId: 'bus-b', city: 'Taichung',
    origin: { name: '起站', lat: 24, lng: 120 }, destination: { name: '台中火車站', lat: 24.1, lng: 120.1 },
    routes: ['bus-a', 'bus-b'].map((routeId) => ({ routeId, navigationId: `nav-${routeId}`, routeVersion: 1, routeToken: `token-${routeId}`, routeName: routeId, totalMinutes: 15, transferCount: 0, accessibilityHighlights: [], legs: [{ ...leg }] })),
    effectivePreferences: { mode: 'wheelchair', travelMode: 'transit', transitPreference: 'bus', maxTransfers: 2, avoidStairs: true, requireElevator: true, departureTime: '2026-10-10T08:00:00+08:00' },
  };
}
