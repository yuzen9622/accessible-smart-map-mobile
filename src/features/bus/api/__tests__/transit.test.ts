import type { ApiResponse } from '@/shared/api';

import { getBusArrival, getBusRouteDetail, getLiveBusPositions, getNearbyBusStops, searchBusRoutes } from '../transit';

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
    expect(res.data?.directions.map((d) => d.direction)).toEqual([0]);
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
