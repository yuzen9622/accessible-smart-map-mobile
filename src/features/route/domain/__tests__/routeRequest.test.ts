// Web 版 useComputeRoute 沒有測試；邏輯抽成純函式後補上，守住 strict schema 與錯誤分類。
import type { WalkLeg } from '../../types/route';
import {
  MAX_ROUTE_METERS,
  classifyRouteError,
  coordToLatLng,
  ensureMinSpan,
  normalizeWaypoints,
  planRouteRequest,
  routeBounds,
} from '../routeRequest';

const TAIPEI_MAIN = { lat: 25.0478, lng: 121.517 };
const CITY_HALL = { lat: 25.0408, lng: 121.5654 };
const KAOHSIUNG = { lat: 22.6273, lng: 120.3014 };
const TOKYO = { lat: 35.6812, lng: 139.7671 };

describe('planRouteRequest', () => {
  it('rejects a request with nothing to route', () => {
    expect(planRouteRequest({}, TAIPEI_MAIN)).toEqual({ ok: false, reason: 'missing-input' });
  });

  it('fills a missing origin with the user location for structured requests', () => {
    const plan = planRouteRequest({ destination: CITY_HALL, mode: 'wheelchair' }, TAIPEI_MAIN);
    expect(plan).toEqual({
      ok: true,
      start: TAIPEI_MAIN,
      end: CITY_HALL,
      request: {
        origin: { latitude: 25.0478, longitude: 121.517 },
        destination: { latitude: 25.0408, longitude: 121.5654 },
        mode: 'wheelchair',
        userLocation: { latitude: 25.0478, longitude: 121.517 },
      },
    });
  });

  it('needs both ends when there is no query and no user location', () => {
    expect(planRouteRequest({ destination: CITY_HALL }, null)).toEqual({ ok: false, reason: 'missing-input' });
  });

  it('lets the backend parse endpoints from a natural-language query', () => {
    const plan = planRouteRequest({ query: '到台北車站' }, TAIPEI_MAIN);
    expect(plan.ok && plan.request).toEqual({
      query: '到台北車站',
      userLocation: { latitude: 25.0478, longitude: 121.517 },
    });
  });

  it('never sends undefined keys — the backend schema is strict', () => {
    const plan = planRouteRequest({ origin: TAIPEI_MAIN, destination: CITY_HALL }, null);
    expect(plan.ok && Object.keys(plan.request).sort()).toEqual(['destination', 'origin']);
  });

  it('allows a domestic long trip but rejects one outside coverage', () => {
    expect(planRouteRequest({ origin: TAIPEI_MAIN, destination: KAOHSIUNG }, null).ok).toBe(true);
    expect(planRouteRequest({ origin: TAIPEI_MAIN, destination: TOKYO }, null)).toEqual({
      ok: false,
      reason: 'too-far',
    });
    expect(MAX_ROUTE_METERS).toBe(500_000);
  });

  it('treats non-finite coordinates as missing so JSON never carries null', () => {
    const nan = { lat: Number.NaN, lng: 121 };
    expect(planRouteRequest({ origin: nan, destination: CITY_HALL }, null)).toEqual({ ok: false, reason: 'missing-input' });
    const plan = planRouteRequest({ origin: TAIPEI_MAIN, destination: CITY_HALL, waypoints: [nan] }, nan);
    expect(plan.ok && Object.keys(plan.request).sort()).toEqual(['destination', 'origin']);
  });

  it('passes waypoints and travel mode through', () => {
    const plan = planRouteRequest(
      { origin: TAIPEI_MAIN, destination: CITY_HALL, waypoints: [{ lat: 25.04, lng: 121.53 }], travelMode: 'walk' },
      null,
    );
    expect(plan.ok && plan.request.waypoints).toEqual([{ latitude: 25.04, longitude: 121.53 }]);
    expect(plan.ok && plan.request.travelMode).toBe('walk');
  });
});

describe('classifyRouteError', () => {
  it('maps the two 422 reasons and treats everything else as a retryable failure', () => {
    expect(classifyRouteError('NO_ROUTE')).toBe('no-route');
    expect(classifyRouteError('NO_ACCESSIBLE_ROUTE')).toBe('no-accessible-route');
    expect(classifyRouteError(undefined)).toBe('failed');
    expect(classifyRouteError('RATE_LIMITED')).toBe('failed');
  });
});

describe('coordinate normalization', () => {
  it('accepts both lat/lng and latitude/longitude shapes', () => {
    expect(coordToLatLng({ lat: 25, lng: 121 })).toEqual({ lat: 25, lng: 121 });
    expect(coordToLatLng({ latitude: 25, longitude: 121 })).toEqual({ lat: 25, lng: 121 });
  });

  it('drops points it cannot parse instead of inventing (0,0)', () => {
    expect(normalizeWaypoints([{ lat: 25, lng: 121 }, { lat: 25 }, null, { lat: Number.NaN, lng: 1 }])).toEqual([
      { lat: 25, lng: 121 },
    ]);
    expect(normalizeWaypoints(undefined)).toEqual([]);
  });
});

describe('routeBounds', () => {
  const leg: WalkLeg = {
    type: 'WALK',
    from: '',
    to: '',
    distanceM: 0,
    minutesEst: 0,
    a11yFacilities: [],
    polyline: [
      [121.52, 25.04],
      [121.5, 25.05],
    ],
  };

  it('covers every polyline point as [west, south, east, north]', () => {
    expect(routeBounds([leg])).toEqual([121.5, 25.04, 121.52, 25.05]);
  });

  it('falls back to origin/destination when no leg has geometry', () => {
    expect(routeBounds([{ ...leg, polyline: [] }], { origin: TAIPEI_MAIN, destination: CITY_HALL })).toEqual([
      121.517, 25.0408, 121.5654, 25.0478,
    ]);
  });

  it('ignores origin/destination when geometry exists but always includes waypoints', () => {
    expect(routeBounds([leg], { origin: KAOHSIUNG, waypoints: [{ lat: 25.06, lng: 121.53 }] })).toEqual([
      121.5, 25.04, 121.53, 25.06,
    ]);
  });

  it('returns null when there is nothing to frame', () => {
    expect(routeBounds([])).toBeNull();
  });
});

describe('routeBounds includeEndpoints / ensureMinSpan', () => {
  const leg: WalkLeg = {
    type: 'WALK',
    from: '',
    to: '',
    distanceM: 0,
    minutesEst: 0,
    a11yFacilities: [],
    polyline: [[121.52, 25.04]],
  };

  it('always frames the endpoints for external routes', () => {
    expect(routeBounds([leg], { destination: { lat: 25.05, lng: 121.53 }, includeEndpoints: true })).toEqual([
      121.52, 25.04, 121.53, 25.05,
    ]);
  });

  it('widens a tiny span around its centre and leaves large ones alone', () => {
    const [w, s, e, n] = ensureMinSpan([121.5, 25.0, 121.5, 25.0]);
    expect(e - w).toBeCloseTo(0.0025, 10);
    expect(n - s).toBeCloseTo(0.0017, 10);
    expect((w + e) / 2).toBeCloseTo(121.5, 10);
    const big: [number, number, number, number] = [121.4, 24.9, 121.6, 25.1];
    expect(ensureMinSpan(big)).toEqual(big);
  });
});
