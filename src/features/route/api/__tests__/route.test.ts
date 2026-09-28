import type { ApiResponse } from '@/shared/api';

import type { NavInstructionsRequest } from '../../types/route';
import {
  getAccessibleRoute,
  getLineRoutePreview,
  getRouteInstructions,
  parseAccessibleRouteData,
  rerouteAccessibleRoute,
} from '../route';

const mockFetchRequest = jest.fn();
jest.mock('@/shared/api', () => ({
  fetchRequest: (...args: unknown[]) => mockFetchRequest(...args),
}));
jest.mock('@/shared/config', () => ({
  getAppConfig: () => ({ apiBaseUrl: 'https://api.test' }),
}));

function envelope(data: unknown): ApiResponse<unknown> {
  return { ok: true, status: 'success', code: 200, message: 'ok', data };
}

beforeEach(() => mockFetchRequest.mockReset());

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
  it('posts the route request and passes the abort signal through', async () => {
    mockFetchRequest.mockResolvedValue(envelope({ routes: [] }));
    const controller = new AbortController();
    await getAccessibleRoute({ query: 'x' }, controller.signal);
    const [url, init] = mockFetchRequest.mock.calls[0];
    expect(url).toBe('https://api.test/api/v1/a11y/accessible-route');
    expect(init).toEqual({ method: 'POST', body: { query: 'x' }, signal: controller.signal });
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
