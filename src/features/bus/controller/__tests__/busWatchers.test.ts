import type { BusLeg } from '@/features/route';
import type { VisibilitySource } from '@/shared/polling';

import { __clearRouteDetailCache } from '../../api/busRouteDetailCache';
import type { RouteDetailDirection } from '../../types/transit';
import { STOP_ETA_POLL_MS, peekLegEtas, watchLegStopEtas, watchLiveBus, type LegEtaSnapshot } from '../busWatchers';
import { flushPromises } from '@/shared/testing/flushPromises';

const mockGetBusRouteDetail = jest.fn();
const mockFetchLeg = jest.fn();

jest.mock('../../api/transit', () => ({
  getBusRouteDetail: (...args: unknown[]) => mockGetBusRouteDetail(...args),
}));
jest.mock('../liveBusTracker', () => ({
  fetchLeg: (...args: unknown[]) => mockFetchLeg(...args),
  tdxRouteName: (leg: { subRouteName?: string; routeName: string }) => leg.subRouteName ?? leg.routeName,
}));

const always: VisibilitySource = { isActive: () => true, subscribe: () => () => {} };

const leg: BusLeg = {
  type: 'BUS',
  routeName: '99',
  subRouteName: '99延',
  direction: 0,
  departureStop: 'A',
  arrivalStop: 'B',
  tdxCity: 'Taichung',
  waitInfo: { time: null, source: 'unavailable' },
  estimatedWaitMinutes: 0,
  polyline: [],
  departureStopA11y: [],
  arrivalStopA11y: [],
};

const directions: RouteDetailDirection[] = [
  { direction: 0, stops: [{ seq: 0, name: 'A', lat: 24, lng: 120, estimateMinutes: 3, statusLabel: '正常' }] },
];

async function flush(): Promise<void> {
  await flushPromises();
}

beforeEach(() => {
  jest.useFakeTimers();
  __clearRouteDetailCache();
  mockGetBusRouteDetail.mockReset();
  mockFetchLeg.mockReset();
});
afterEach(() => jest.useRealTimers());

describe('watchLegStopEtas', () => {
  it('asks for the booked sub-route and reports loading then ready', async () => {
    mockGetBusRouteDetail.mockResolvedValue({ ok: true, data: { directions } });
    const updates: LegEtaSnapshot[] = [];
    const stop = watchLegStopEtas(leg, false, (s) => updates.push(s), always);
    await flush();
    expect(mockGetBusRouteDetail).toHaveBeenCalledWith('99延', 'Taichung', undefined, undefined);
    expect(updates.map((u) => u.status)).toEqual(['loading', 'ready']);
    expect(peekLegEtas(leg).status).toBe('ready');
    stop();
  });

  it('prefetch mode fetches once and never schedules a timer', async () => {
    mockGetBusRouteDetail.mockResolvedValue({ ok: true, data: { directions } });
    const stop = watchLegStopEtas(leg, false, () => {}, always);
    await flush();
    expect(jest.getTimerCount()).toBe(0);
    stop();
  });

  it('polling forces a refresh past the shared cache every interval', async () => {
    mockGetBusRouteDetail.mockResolvedValue({ ok: true, data: { directions } });
    const stop = watchLegStopEtas(leg, true, () => {}, always);
    await flush();
    expect(mockGetBusRouteDetail).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(STOP_ETA_POLL_MS);
    await flush();
    expect(mockGetBusRouteDetail).toHaveBeenCalledTimes(2);
    stop();
  });

  it('keeps the static stops but drops the stale ETA when a refresh fails', async () => {
    mockGetBusRouteDetail
      .mockResolvedValueOnce({ ok: true, data: { directions } })
      .mockRejectedValueOnce(new Error('network'));
    const updates: LegEtaSnapshot[] = [];
    const stop = watchLegStopEtas(leg, true, (s) => updates.push(s), always);
    await flush();
    jest.advanceTimersByTime(STOP_ETA_POLL_MS);
    await flush();
    expect(updates.at(-1)).toEqual({
      directions: [{ direction: 0, stops: [{ seq: 0, name: 'A', lat: 24, lng: 120, estimateMinutes: null, statusLabel: '' }] }],
      status: 'error',
    });
    stop();
  });

  it('starts warm without a loading flash when the cache already has the line', async () => {
    mockGetBusRouteDetail.mockResolvedValue({ ok: true, data: { directions } });
    const prefetch = watchLegStopEtas(leg, false, () => {}, always);
    await flush();
    prefetch();
    const updates: LegEtaSnapshot[] = [];
    const stop = watchLegStopEtas(leg, false, (s) => updates.push(s), always);
    expect(updates[0]).toEqual({ directions, status: 'ready' });
    stop();
  });

  it('is idle for a leg without a city', () => {
    const updates: LegEtaSnapshot[] = [];
    watchLegStopEtas({ ...leg, tdxCity: undefined, cityCode: undefined }, true, (s) => updates.push(s), always)();
    expect(updates).toEqual([{ directions: null, status: 'idle' }]);
    expect(mockGetBusRouteDetail).not.toHaveBeenCalled();
  });
});

describe('watchLiveBus', () => {
  it('publishes the tracked vehicle and stops cleanly', async () => {
    mockFetchLeg.mockResolvedValue([{ plateNumb: 'KKA-1234' }]);
    const onBuses = jest.fn();
    const stop = watchLiveBus(() => leg, onBuses, always);
    await flush();
    expect(onBuses).toHaveBeenCalledWith([{ plateNumb: 'KKA-1234' }]);
    stop();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('reports no vehicle when a poll throws instead of keeping the last position', async () => {
    mockFetchLeg.mockResolvedValueOnce([{ plateNumb: 'KKA-1234' }]).mockRejectedValueOnce(new Error('network'));
    const onBuses = jest.fn();
    const stop = watchLiveBus(() => leg, onBuses, always);
    await flush();
    jest.advanceTimersByTime(15_000);
    await flush();
    expect(onBuses).toHaveBeenCalledTimes(2);
    expect(onBuses).toHaveBeenLastCalledWith([]);
    stop();
  });
});
