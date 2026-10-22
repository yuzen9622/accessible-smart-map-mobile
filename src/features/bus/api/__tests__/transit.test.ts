import type { ApiResponse } from '@/shared/api';

import { getBusArrival, getBusRouteDetail, getLiveBusPositions, getNearbyBusStops, getStopArrivals, searchBusRoutes } from '../transit';

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

beforeEach(() => {
  mockFetchRequest.mockReset();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe('transit api', () => {
  it('builds the route-detail query and keeps only well-formed directions', async () => {
    mockFetchRequest.mockResolvedValue(
      envelope({
        directions: [
          { direction: 0, stops: [{ seq: 0, name: 'A', lat: 1, lng: 2, estimateMinutes: null, statusLabel: '' }] },
          { direction: 2, stops: [] },
          { direction: 1, stops: [{ name: 'broken' }] },
        ],
      }),
    );
    const res = await getBusRouteDetail('99延', 'Taichung');
    expect(mockFetchRequest.mock.calls[0][0]).toBe(
      'https://api.test/api/v1/transit/bus/route-detail?routeName=99%E5%BB%B6&city=Taichung',
    );
    // direction 2 帶著空站序也被保留（站序驗證只擋壞站），只有壞站的那組被丟掉。
    expect(res.data?.directions.map((d) => d.direction)).toEqual([0, 2]);
  });

  it('sends subRouteUid to route-detail only when given, and never a direction', async () => {
    mockFetchRequest.mockResolvedValue(envelope({ directions: [] }));
    await getBusRouteDetail('99', 'Taichung', undefined, 'TXG991');
    expect(mockFetchRequest.mock.calls[0][0]).toBe(
      'https://api.test/api/v1/transit/bus/route-detail?routeName=99&city=Taichung&subRouteUid=TXG991',
    );
  });

  it('parses refreshed departure candidates from planned bus-arrivals and drops malformed ones', async () => {
    const valid = {
      candidateId: 'TXG300|0|trip|1792661940000',
      routeName: '300',
      subRouteUid: 'TXG300',
      direction: 0,
      departureStopId: 'TXG13530',
      arrivalStopId: 'TXG12251',
      tripId: 'trip',
      estimatedWaitMinutes: 16,
      boardingTime: '2026-10-22T17:39:00.000+08:00',
      alightingTime: '2026-10-22T17:42:00.000+08:00',
      boardingTimeSource: 'schedule',
      alightingTimeSource: 'schedule',
      vehicleAccessibility: 'low_floor',
      hasLiftOrRamp: null,
      selected: true,
    };
    mockFetchRequest.mockResolvedValueOnce(
      envelope({ directions: [], departureCandidates: [valid, { ...valid, boardingTimeSource: 'guess' }, { ...valid, direction: 2 }, { ...valid, estimatedWaitMinutes: -3 }, { ...valid, estimatedWaitMinutes: 'soon' }] }),
    );
    const res = await getBusRouteDetail('300', 'Taichung', undefined, undefined, { routeToken: 'tok', legIndex: 3 });
    expect(mockFetchRequest.mock.calls[0][0]).toBe('https://api.test/api/v1/a11y/accessible-route/bus-arrivals?routeToken=tok&legIndex=3');
    expect(res.data?.departureCandidates).toEqual([{ ...valid, subRouteName: undefined, plateNumb: undefined }]);

    mockFetchRequest.mockResolvedValueOnce(envelope({ directions: [] }));
    expect((await getBusRouteDetail('300', 'Taichung')).data?.departureCandidates).toBeUndefined();
  });

  it('keeps a valid route polyline and drops unusable ones', async () => {
    const stop = { seq: 0, name: 'A', lat: 1, lng: 2, estimateMinutes: null, statusLabel: '' };
    mockFetchRequest.mockResolvedValue(
      envelope({
        directions: [
          { direction: 0, stops: [stop], polyline: [[121.5, 25], ['x', 25], [121.6, 25.1], [121.7]] },
          { direction: 1, stops: [stop], polyline: null },
          { direction: 0, stops: [stop], polyline: [[121.5, 25], [Number.NaN, 25]] },
        ],
      }),
    );
    const res = await getBusRouteDetail('307', 'Taipei');
    expect(res.data?.directions.map((d) => d.polyline)).toEqual([
      [
        [121.5, 25],
        [121.6, 25.1],
      ],
      undefined,
      undefined,
    ]);
  });

  it('drops vehicles without a usable position or direction', async () => {
    mockFetchRequest.mockResolvedValue(
      envelope({
        routeName: '99',
        buses: [
          { plateNumb: 'A', direction: 1, lat: 24, lng: 120 },
          { plateNumb: 'B', direction: 1, lat: null, lng: 120 },
          // 方向不明：無法判斷是不是往使用者那邊開，丟掉而不是補成 0。
          { plateNumb: 'C', lat: 24, lng: 120 },
        ],
      }),
    );
    const res = await getLiveBusPositions({ routeName: '99', city: 'Taichung', direction: 1 });
    expect(mockFetchRequest.mock.calls[0][0]).toBe(
      'https://api.test/api/v1/transit/bus/positions?routeName=99&city=Taichung&direction=1',
    );
    expect(res.data?.buses.map((b) => b.plateNumb)).toEqual(['A']);
  });

  it.each([0, 1, 2, 10, 255] as const)('keeps direction %i on parsed buses, arrivals and route-detail', async (direction) => {
    const stop = { seq: 0, name: 'A', lat: 1, lng: 2, estimateMinutes: null, statusLabel: '' };
    mockFetchRequest.mockResolvedValueOnce(envelope({ directions: [{ direction, stops: [stop], subRouteUid: 'U' }] }));
    expect((await getBusRouteDetail('R', 'Taipei')).data?.directions.map((d) => d.direction)).toEqual([direction]);
    mockFetchRequest.mockResolvedValueOnce(envelope({ arrivals: [{ stopName: 'A', direction, estimateMinutes: 3, statusLabel: '' }] }));
    expect((await getBusArrival({ routeName: 'R', stopName: 'A', direction })).data?.arrivals.map((a) => a.direction)).toEqual([direction]);
    mockFetchRequest.mockResolvedValueOnce(envelope({ buses: [{ plateNumb: 'P', direction, lat: 24, lng: 120 }] }));
    expect((await getLiveBusPositions({ routeName: 'R', direction })).data?.buses.map((b) => b.direction)).toEqual([direction]);
  });

  it.each(['10', '0', null, undefined, 3, -1, 256, 1.5, ''])('rejects invalid direction %p on every parser without hurting valid rows', async (bad) => {
    const stop = { seq: 0, name: 'A', lat: 1, lng: 2, estimateMinutes: null, statusLabel: '' };
    mockFetchRequest.mockResolvedValueOnce(
      envelope({ directions: [{ direction: bad, stops: [stop] }, { direction: 10, stops: [stop] }] }),
    );
    expect((await getBusRouteDetail('R', 'Taipei')).data?.directions.map((d) => d.direction)).toEqual([10]);
    mockFetchRequest.mockResolvedValueOnce(
      envelope({ arrivals: [{ stopName: 'A', direction: bad }, { stopName: 'B', direction: 10 }] }),
    );
    expect((await getBusArrival({ routeName: 'R', stopName: 'A' })).data?.arrivals.map((a) => a.stopName)).toEqual(['B']);
    mockFetchRequest.mockResolvedValueOnce(
      envelope({
        buses: [
          { plateNumb: 'BAD', direction: bad, lat: 24, lng: 120 },
          { plateNumb: 'OK', direction: 255, lat: 24, lng: 120 },
        ],
      }),
    );
    expect((await getLiveBusPositions({ routeName: 'R' })).data?.buses.map((b) => b.plateNumb)).toEqual(['OK']);
    mockFetchRequest.mockResolvedValueOnce(
      envelope({ arrivals: [{ routeName: 'R', direction: bad }, { routeName: 'S', direction: 2 }] }),
    );
    expect((await getStopArrivals({ stopName: 'A', city: 'Taipei', position: { lat: 1, lng: 2 } })).data?.arrivals.map((a) => a.routeName)).toEqual(['S']);
  });

  it.each([
    [0, '&direction=0'],
    [1, '&direction=1'],
    [2, '&direction=2'],
    [10, '&direction=10'],
    [255, '&direction=255'],
    [undefined, ''],
    [null, ''],
  ] as const)('puts direction %p in the arrival and positions URLs as %p', async (direction, suffix) => {
    mockFetchRequest.mockResolvedValue(envelope({ arrivals: [], buses: [] }));
    await getBusArrival({ routeName: '307', stopName: 'S', city: 'Taipei', direction });
    expect(mockFetchRequest.mock.calls[0][0]).toBe(
      `https://api.test/api/v1/transit/bus/arrival?routeName=307&stopName=S${suffix}&city=Taipei`,
    );
    await getLiveBusPositions({ routeName: '307', city: 'Taipei', direction });
    expect(mockFetchRequest.mock.calls[1][0]).toBe(`https://api.test/api/v1/transit/bus/positions?routeName=307&city=Taipei${suffix}`);
    expect(mockFetchRequest.mock.calls.every(([url]) => !String(url).includes('subRouteUid'))).toBe(true);
  });

  it('only parses data from a successful envelope', async () => {
    mockFetchRequest.mockResolvedValue({ ok: false, status: 'error', code: 500, message: 'x', data: { arrivals: [{ stopName: 'A', direction: 0 }] } });
    expect((await getBusArrival({ routeName: 'R', stopName: 'A' })).data).toBeUndefined();
    expect((await getLiveBusPositions({ routeName: 'R' })).data).toBeUndefined();
    expect((await getBusRouteDetail('R', 'Taipei')).data).toBeUndefined();
  });

  it('omits empty arrival params and non-finite search locations', async () => {
    mockFetchRequest.mockResolvedValue(envelope({ arrivals: [] }));
    await getBusArrival({ routeName: '26', stopName: '公園' });
    expect(mockFetchRequest.mock.calls[0][0]).toBe(
      'https://api.test/api/v1/transit/bus/arrival?routeName=26&stopName=%E5%85%AC%E5%9C%92',
    );
    mockFetchRequest.mockResolvedValue(envelope({ routes: [] }));
    await searchBusRoutes(' 307 ', { lat: Number.NaN, lng: 121 });
    expect(mockFetchRequest.mock.calls[1][0]).toBe('https://api.test/api/v1/transit/bus/search-routes?keyword=307');
  });

  it('clears its timeout after the request settles', async () => {
    mockFetchRequest.mockResolvedValue(envelope({ stops: [] }));
    await getNearbyBusStops({ lat: 25, lng: 121 });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('aborts when the caller cancels', () => {
    const signals: AbortSignal[] = [];
    mockFetchRequest.mockImplementation((_url: string, init: { signal: AbortSignal }) => {
      signals.push(init.signal);
      return new Promise(() => {});
    });
    const caller = new AbortController();
    void getNearbyBusStops({ lat: 25, lng: 121 }, caller.signal);
    caller.abort();
    expect(signals[0].aborted).toBe(true);
  });

  it('aborts after 10 seconds without an answer', () => {
    const signals: AbortSignal[] = [];
    mockFetchRequest.mockImplementation((_url: string, init: { signal: AbortSignal }) => {
      signals.push(init.signal);
      return new Promise(() => {});
    });
    void getNearbyBusStops({ lat: 25, lng: 121 });
    jest.advanceTimersByTime(9_999);
    expect(signals[0].aborted).toBe(false);
    jest.advanceTimersByTime(1);
    expect(signals[0].aborted).toBe(true);
  });
});


it('sends only the route capability and full leg index for a planned bus', async () => {
  mockFetchRequest.mockResolvedValue(envelope({ directions: [
    { direction: 0, stops: [{ seq: 1, name: 'A', lat: 25, lng: 121, estimateMinutes: 5, statusLabel: '正常', plateNumb: 'BUS-10' }] },
  ] }));
  const res = await getBusRouteDetail('99', 'Taipei', undefined, 'branch', { routeToken: 'plan-token', legIndex: 2 });
  expect(mockFetchRequest.mock.calls[0][0]).toBe('https://api.test/api/v1/a11y/accessible-route/bus-arrivals?routeToken=plan-token&legIndex=2');
  expect(res.data?.directions[0].stops[0].plateNumb).toBe('BUS-10');
});

it('preserves endpoint-specific display fields and aligned route labels without changing IDs', async () => {
  mockFetchRequest.mockResolvedValue(envelope({ stops: [
    { stopUid: 'id-a', stopName: '同名', stopDisplayName: 'A', coordinates: [121, 25], routes: ['1', 42, '2'], routeDisplayNames: ['One', 'bad', 'Two'] },
    { stopUid: 'id-b', stopName: '同名', stopDisplayName: 'B', coordinates: [122, 25], routes: ['1', '2'], routeDisplayNames: ['One', null] },
  ] }));
  const result = await getNearbyBusStops({ lat: 25, lng: 121 }, undefined, 'en');
  expect(result.data?.stops.map(s => [s.stopUid, s.stopName, s.stopDisplayName, s.routes, s.routeDisplayNames])).toEqual([
    ['id-a', '同名', 'A', ['1', '2'], ['One', 'Two']],
    ['id-b', '同名', 'B', ['1', '2'], ['One', '2']],
  ]);
  expect(mockFetchRequest.mock.calls[0][0]).toContain('lang=en');
});

it('keeps route-detail stop displayName and direction labels, but does not send lang to strict planned endpoint', async () => {
  mockFetchRequest.mockResolvedValue(envelope({ routeDisplayName: 'Route', directions: [{ direction: 0, subRouteDisplayName: 'Branch', fromDisplayName: 'Origin', toDisplayName: 'Destination', stops: [{ seq: 1, name: '原名', displayName: 'Name', lat: 25, lng: 121 }] }] }));
  const result = await getBusRouteDetail('99', 'Taipei', undefined, undefined, undefined, 'en');
  expect(result.data?.routeDisplayName).toBe('Route');
  expect(result.data?.directions[0]).toMatchObject({ subRouteDisplayName: 'Branch', fromDisplayName: 'Origin', toDisplayName: 'Destination', stops: [{ name: '原名', displayName: 'Name' }] });
  expect(mockFetchRequest.mock.calls[0][0]).toContain('lang=en');
  await getBusRouteDetail('99', 'Taipei', undefined, undefined, { routeToken: 'token', legIndex: 0 }, 'en');
  expect(mockFetchRequest.mock.calls[1][0]).toBe('https://api.test/api/v1/a11y/accessible-route/bus-arrivals?routeToken=token&legIndex=0');
});

it('preserves arrival, position, search and stop-board display fields', async () => {
  mockFetchRequest.mockResolvedValue(envelope({ routeName: '99', routeDisplayName: 'Route', stopName: '站', stopDisplayName: 'Stop', arrivals: [{ stopName: '站', direction: 0, subRouteDisplayName: 'Branch', stopDisplayName: 'Stop' }] }));
  expect((await getBusArrival({}, undefined, 'en')).data).toMatchObject({ routeName: '99', routeDisplayName: 'Route', stopDisplayName: 'Stop', arrivals: [{ stopDisplayName: 'Stop', subRouteDisplayName: 'Branch' }] });
  mockFetchRequest.mockResolvedValue(envelope({ routeDisplayName: 'Route', buses: [{ plateNumb: 'P', direction: 0, lat: 25, lng: 121, subRouteDisplayName: 'Branch' }] }));
  expect((await getLiveBusPositions({ routeName: '99' }, undefined, 'en')).data).toMatchObject({ routeDisplayName: 'Route', buses: [{ subRouteDisplayName: 'Branch' }] });
  mockFetchRequest.mockResolvedValue(envelope({ routes: [{ routeName: '99', city: 'Taipei', routeDisplayName: 'Route', departureDisplayName: 'From', destinationDisplayName: 'To' }] }));
  expect((await searchBusRoutes('99', null, undefined, 'en')).data?.routes[0]).toMatchObject({ routeDisplayName: 'Route', departureDisplayName: 'From', destinationDisplayName: 'To' });
  mockFetchRequest.mockResolvedValue(envelope({ stopDisplayName: 'Stop', arrivals: [{ routeName: '99', direction: 0, routeDisplayName: 'Route', subRouteDisplayName: 'Branch', headsignDisplayName: 'To' }] }));
  expect((await getStopArrivals({ stopName: '站', city: 'Taipei', position: { lat: 25, lng: 121 } }, undefined, 'en')).data).toMatchObject({ stopDisplayName: 'Stop', arrivals: [{ routeDisplayName: 'Route', subRouteDisplayName: 'Branch', headsignDisplayName: 'To' }] });
});
