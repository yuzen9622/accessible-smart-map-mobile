import type { ApiResponse } from '@/shared/api';

import type { NavInstructionsRequest } from '../../types/route';
import { venueHandoffFixture } from '../../domain/testing/venueHandoffFixture';
import {
  getAccessibleRoute,
  getLineRoutePreview,
  getRouteInstructions,
  parseAccessibleRouteData,
  rerouteAccessibleRoute,
  ROUTE_TIMEOUT_MS,
} from '../route';

const mockFetchRequest = jest.fn();
let mockAccessToken: string | undefined;
jest.mock('@/shared/api', () => ({
  fetchRequest: (...args: unknown[]) => mockFetchRequest(...args),
  getAccessToken: () => mockAccessToken,
}));
jest.mock('@/shared/config', () => ({
  getAppConfig: () => ({ apiBaseUrl: 'https://api.test' }),
}));

function envelope(data: unknown): ApiResponse<unknown> {
  return { ok: true, status: 'success', code: 200, message: 'ok', data };
}

beforeEach(() => mockFetchRequest.mockReset());

describe('indoor handoff parsing', () => {
  it('validates the complete handoff and never accepts only the gate', () => {
    const handoff = venueHandoffFixture();
    const data = { routes: [], venueArrival: handoff.arrival, venueLeg: handoff.leg };
    expect(parseAccessibleRouteData(data)).toMatchObject(data);
    expect(() => parseAccessibleRouteData({ ...data, venueLeg: undefined })).toThrow();
    expect(() => parseAccessibleRouteData({ ...data, venueArrival: undefined })).toThrow();
    expect(() => parseAccessibleRouteData({ ...data, venueLeg: { ...handoff.leg, venueVersion: 4 } })).toThrow();
    expect(() => parseAccessibleRouteData({ ...data, venueLeg: { ...handoff.leg, toPlaceId: 'wrong-room' } })).toThrow();
    expect(() => parseAccessibleRouteData({ ...data, venueArrival: { ...handoff.arrival, gateLocation: { lat: 95, lng: 120 } } })).toThrow();
  });
});

describe('getRouteInstructions', () => {
  it('sends only routeToken/userHeading/language even when the caller passes more', async () => {
    mockFetchRequest.mockResolvedValue(envelope({ instructions: [], initialBearing: 0, totalSteps: 0, warnings: [] }));
    const withExtras = JSON.parse(
      '{"routeToken":"t","userHeading":90,"language":"zh-TW","route":{"legs":[]},"routeId":"r1"}',
    ) as NavInstructionsRequest;

    await getRouteInstructions(withExtras);

    const [url, init] = mockFetchRequest.mock.calls[0];
    expect(url).toBe('https://api.test/api/v1/a11y/route/instructions');
    expect(init.body).toEqual({ routeToken: 't', userHeading: 90, language: 'zh-TW' });
  });

  it('drops a heading that is not ready yet instead of sending null', async () => {
    mockFetchRequest.mockResolvedValue(envelope({ instructions: [] }));
    await getRouteInstructions({ routeToken: 't', userHeading: Number.NaN });
    expect(mockFetchRequest.mock.calls[0][1].body).toEqual({ routeToken: 't' });
  });
});

describe('rerouteAccessibleRoute', () => {
  it('keeps envelope and route warning indices separate, including replay under another language', async () => {
    const data = {
      navigationId: 'n', previousRouteVersion: 1, routeVersion: 2, routeToken: 'new-token',
      replayed: true, currentStepIndex: 0, instructions: [],
      warnings: ['source alert', 'Sparse data'],
      warningDetails: [{ index: 1, code: 'ROUTE_DATA_SPARSE', message: 'Sparse data' }],
      route: { legs: [], warnings: ['Sparse data'], warningDetails: [{ index: 0, code: 'ROUTE_DATA_SPARSE', message: 'Sparse data' }] },
    };
    mockFetchRequest.mockResolvedValue(envelope(data));
    for (const language of ['en', 'zh-TW'] as const) {
      const response = await rerouteAccessibleRoute({
        routeToken: 't', currentPosition: { latitude: 25, longitude: 121 },
        previousRouteVersion: 1, reason: 'MANUAL', clientRequestId: 'same-operation', language,
      });
      expect(response.data).toMatchObject(data);
      expect(response.data?.warningDetails?.[0].index).toBe(1);
      expect(response.data?.route.warningDetails?.[0].index).toBe(0);
    }
    expect(mockFetchRequest.mock.calls.map((call) => call[1].body.language)).toEqual(['en', 'zh-TW']);
    expect(mockFetchRequest.mock.calls.map((call) => call[1].body.clientRequestId)).toEqual(['same-operation', 'same-operation']);
  });
  it('whitelists the reroute body', async () => {
    mockFetchRequest.mockResolvedValue(envelope(null));
    const request = JSON.parse(
      '{"routeToken":"t","currentPosition":{"latitude":25,"longitude":121,"heading":3},"previousRouteVersion":1,"reason":"OFF_ROUTE","clientRequestId":"c1","extra":true}',
    );
    await rerouteAccessibleRoute(request);
    expect(mockFetchRequest.mock.calls[0][1].body).toEqual({
      routeToken: 't',
      currentPosition: { latitude: 25, longitude: 121 },
      previousRouteVersion: 1,
      reason: 'OFF_ROUTE',
      clientRequestId: 'c1',
    });
  });

  it('parses both instructions and steps shapes', async () => {
    const base = { navigationId: 'n', routeVersion: 2, routeToken: 't', route: { legs: [{ type: 'WALK' }] } };
    mockFetchRequest.mockResolvedValueOnce(envelope({ ...base, steps: [{ text: 'go', type: 'turn' }] }));
    const res = await rerouteAccessibleRoute({
      routeToken: 't',
      currentPosition: { latitude: 25, longitude: 121 },
      previousRouteVersion: 1,
      reason: 'OFF_ROUTE',
      clientRequestId: 'c',
    });
    expect(res.data?.routeVersion).toBe(2);
    expect(res.data?.route.legs[0].polyline).toEqual([]);
  });
});

describe('parseAccessibleRouteData', () => {
  it('preserves all optional details, source strings and localized supplementary fields', () => {
    const raw = {
      legs: [{ type: 'WALK' }],
      warnings: ['source alert', 'No connector'],
      warningDetails: [{ index: 1, code: 'ROUTE_WALK_CONNECTOR_UNAVAILABLE', message: 'No connector', params: { gapM: 20 } }],
      scoreWarnings: ['Conservative score'],
      scoreWarningDetails: [{ index: 0, code: 'ROUTE_DATA_SPARSE', message: 'Conservative score' }],
      accessibilityHighlights: ['A toilet nearby'],
      accessibilityHighlightDetails: [{ index: 0, code: 'ROUTE_TOILET_AVAILABLE', message: 'A toilet nearby', params: { count: 1 } }],
      factors: [{ text: 'Limited data' }], accessibilitySummary: 'Conservative estimate',
    };
    const slopeConstraint = { requestedMaxPercent: 5, enforced: false, note: 'Slope limit not enforced' };
    const parsed = parseAccessibleRouteData({ routes: [raw], slopeConstraint });
    expect(parsed?.routes[0]).toMatchObject(raw);
    expect(parsed?.slopeConstraint).toEqual(slopeConstraint);
  });
  it('keeps good routes and fills fields Web also treats as optional', () => {
    const data = parseAccessibleRouteData({
      routes: [
        { routeName: '步行', totalMinutes: 10, transferCount: 0, accessibilityHighlights: [], legs: [{ type: 'WALK' }] },
        { routeId: 'ok', routeName: 'b', totalMinutes: 5, legs: [{ type: 'WALK', polyline: [[121, 25]] }] },
      ],
    });
    expect(data?.routes.map((r) => r.routeId)).toEqual(['route-0', 'ok']);
    expect(data?.routes[0].legs[0].polyline).toEqual([]);
    expect(data?.routes[1].accessibilityHighlights).toEqual([]);
  });

  it('drops only the malformed route instead of the whole batch', () => {
    const data = parseAccessibleRouteData({
      routes: [{ routeId: 'bad', legs: 'nope' }, { routeId: 'good', legs: [{ type: 'BUS' }] }],
    });
    expect(data?.routes.map((r) => r.routeId)).toEqual(['good']);
  });

  it('drops routes containing a leg type this app does not know', () => {
    const data = parseAccessibleRouteData({
      routes: [{ routeId: 'ferry', legs: [{ type: 'FERRY' }] }, { routeId: 'walk', legs: [{ type: 'WALK' }] }],
    });
    expect(data?.routes.map((r) => r.routeId)).toEqual(['walk']);
  });

  it('returns undefined when there is no routes array at all', () => {
    expect(parseAccessibleRouteData(null)).toBeUndefined();
    expect(parseAccessibleRouteData({ routes: {} })).toBeUndefined();
  });
});

describe('transport', () => {
  it.each(['en', 'zh-TW'] as const)('forwards initial planning language %s without changing authentication', async (language) => {
    mockFetchRequest.mockResolvedValue(envelope({ routes: [] }));
    await getAccessibleRoute({ query: 'station', language });
    expect(mockFetchRequest.mock.calls[0][1]).toMatchObject({
      body: { query: 'station', language }, requireAuth: false,
    });
  });
  it('posts the route request and passes the abort signal through', async () => {
    mockFetchRequest.mockResolvedValue(envelope({ routes: [] }));
    const controller = new AbortController();
    await getAccessibleRoute({ query: 'x' }, controller.signal);
    const [url, init] = mockFetchRequest.mock.calls[0];
    expect(url).toBe('https://api.test/api/v1/a11y/accessible-route');
    expect(init).toEqual({
      method: 'POST',
      body: { query: 'x' },
      signal: controller.signal,
      requireAuth: false,
      timeoutMs: ROUTE_TIMEOUT_MS,
    });
  });

  it('gives route computation a longer timeout than the shared 20 s default', () => {
    // 後端冷快取時跨縣市路線實測 23 秒以上；低於這個值使用者就會看到「路線規劃失敗」，Web 卻算得出來。
    expect(ROUTE_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);
  });

  it('sends the Bearer token (requireAuth) only when logged in', async () => {
    mockFetchRequest.mockResolvedValue(envelope({ routes: [] }));
    mockAccessToken = 'tok';
    await getAccessibleRoute({ query: 'x' });
    mockAccessToken = undefined;
    expect(mockFetchRequest.mock.calls[0][1]).toMatchObject({ requireAuth: true });
  });

  it('drops preview routes with unknown leg types', async () => {
    mockFetchRequest.mockResolvedValue(
      envelope({
        sessionId: 's',
        origin: { label: 'o' },
        destination: { label: 'd', lat: 25, lng: 121 },
        routes: [
          { routeName: 'x', totalMinutes: 1, legs: [{ type: 'HOVERCRAFT' }] },
          { routeName: 'y', totalMinutes: 1, legs: [{ type: 'WALK' }] },
        ],
      }),
    );
    const res = await getLineRoutePreview('s');
    expect(res.data?.routes.map((r) => r.routeName)).toEqual(['y']);
  });

  it('encodes the preview session id', async () => {
    mockFetchRequest.mockResolvedValue(envelope(null));
    const res = await getLineRoutePreview('a/b c');
    expect(mockFetchRequest.mock.calls[0][0]).toBe('https://api.test/api/v1/line/route-preview?sessionId=a%2Fb%20c');
    expect(res.data).toBeUndefined();
  });
});

it('preserves name source/display/sidecar fields and exactly nine WALK machine fields', () => {
  const step = { relativeDirection: 'CONTINUE', absoluteDirection: null, streetName: '道路', bogusName: false,
    area: false, stairs: false, steepSlope: false, distanceM: 10, location: [121, 25] };
  const leg = { type: 'WALK', from: '甲', to: '乙', fromNameEn: 'A', toNameEn: 'B',
    fromDisplayName: 'A', toDisplayName: 'B', steps: [step],
    stepStreetNames: [{ index: 0, streetName: '道路', nameEn: 'Road', displayName: 'Road' }],
    a11yFacilities: [{ osmId: 'id', name: '廁所', nameEn: 'Toilet', displayName: 'Toilet' }] };
  const parsed = parseAccessibleRouteData({ routes: [{ legs: [leg] }] });
  expect(parsed?.routes[0].legs[0]).toMatchObject(leg);
  const walk = parsed?.routes[0].legs[0];
  expect(walk?.type === 'WALK' && Object.keys(walk.steps![0])).toEqual(Object.keys(step));
});

it('records plan request language but never treats reroute replay language as original provenance', async () => {
  const { presentRouteNames } = jest.requireActual('../../domain/routeNames');
  const route = { routeToken: 't', legs: [{ type: 'WALK', from: '甲', to: '乙', fromNameEn: 'A',
    fromDisplayName: 'Original display', a11yFacilities: [], polyline: [] }] };
  mockFetchRequest.mockResolvedValue(envelope({ routes: [route] }));
  const planned = await getAccessibleRoute({ language: 'en' });
  expect(presentRouteNames(planned.data!.routes[0], 'en').legs[0].fromDisplayName).toBe('Original display');
  expect(presentRouteNames(planned.data!.routes[0], 'zh-TW').legs[0].fromDisplayName).toBe('甲');
  mockFetchRequest.mockResolvedValue(envelope({ route, replayed: true, navigationId: 'n', routeVersion: 2,
    routeToken: 't', instructions: [] }));
  const replay = await rerouteAccessibleRoute({ routeToken: 't', language: 'en', currentPosition: { latitude: 25, longitude: 121 },
    previousRouteVersion: 1, reason: 'MANUAL', clientRequestId: 'same' });
  // Parser preserves original leg references; use a fresh response object to represent a replay from HTTP.
  // The replay cannot newly assign request language even though the retry requested English.
  mockFetchRequest.mockResolvedValue(envelope({ route: JSON.parse(JSON.stringify(route)), replayed: true,
    navigationId: 'n', routeVersion: 2, routeToken: 't', instructions: [] }));
  const freshReplay = await rerouteAccessibleRoute({ routeToken: 't', language: 'en', currentPosition: { latitude: 25, longitude: 121 },
    previousRouteVersion: 1, reason: 'MANUAL', clientRequestId: 'same' });
  expect(replay.data?.routeToken).toBe('t');
  expect(presentRouteNames(freshReplay.data!.route, 'en').legs[0].fromDisplayName).toBe('A');
});
