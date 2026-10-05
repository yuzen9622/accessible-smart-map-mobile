import { act, renderHook } from '@testing-library/react-native';

import { flushPromises } from '@/shared/testing/flushPromises';

import type { RideSelection } from '../../domain';
import type { RouteDetailDirection } from '../../types/transit';
import { useBusRouteDetail } from '../useBusRouteDetail';
import { useRouteLiveBuses } from '../useRouteLiveBuses';
import { useStopArrivals } from '../useStopArrivals';
import { useTrackedArrival } from '../useTrackedArrival';

const mockGetBusRouteDetail = jest.fn();
const mockGetLiveBusPositions = jest.fn();
const mockGetBusArrival = jest.fn();
const mockGetStopArrivals = jest.fn();

jest.mock('@/shared/api', () => ({
  ApiError: class ApiError extends Error {
    code: number;
    constructor(message: string, code: number) {
      super(message);
      this.code = code;
    }
  },
}));
jest.mock('../../api/transit', () => ({
  getBusRouteDetail: (...args: unknown[]) => mockGetBusRouteDetail(...args),
  getLiveBusPositions: (...args: unknown[]) => mockGetLiveBusPositions(...args),
  getBusArrival: (...args: unknown[]) => mockGetBusArrival(...args),
  getStopArrivals: (...args: unknown[]) => mockGetStopArrivals(...args),
}));
jest.mock('@/shared/polling', () => {
  const actual = jest.requireActual('@/shared/polling/poller');
  return {
    createPoller: actual.createPoller,
    appStateVisibility: { isActive: () => true, subscribe: () => () => {} },
  };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const stop = (name: string, estimateMinutes: number | null, statusLabel = '正常') => ({
  seq: 1,
  name,
  lat: 25,
  lng: 121,
  estimateMinutes,
  statusLabel,
});
const detail = (...directions: RouteDetailDirection[]) => ({ ok: true, data: { directions } });

const bus = (plateNumb: string, direction: number, subRouteUid?: string) => ({
  plateNumb,
  direction,
  subRouteUid,
  lat: 25,
  lng: 121,
});

afterEach(() => jest.useRealTimers());

beforeEach(() => {
  mockGetBusRouteDetail.mockReset();
  mockGetLiveBusPositions.mockReset();
  mockGetBusArrival.mockReset();
  mockGetStopArrivals.mockReset();
});

describe('useBusRouteDetail', () => {
  it('a slow response for the old route never overwrites the new route', async () => {
    const slow = deferred<unknown>();
    mockGetBusRouteDetail.mockImplementation((routeName: string) =>
      routeName === 'OLD' ? slow.promise : Promise.resolve(detail({ direction: 0, stops: [stop('new', 3)] })),
    );
    const { result, rerender } = await renderHook(({ route }: { route: string }) => useBusRouteDetail(route, 'Taipei'), {
      initialProps: { route: 'OLD' },
    });
    await rerender({ route: 'NEW' });
    await act(flushPromises);
    expect(result.current.directions[0]?.stops[0]?.name).toBe('new');
    await act(async () => {
      slow.resolve(detail({ direction: 0, stops: [stop('old', 9)] }));
      await flushPromises();
    });
    expect(result.current.directions[0]?.stops[0]?.name).toBe('new');
  });

  it('the first render after switching routes does not leak the previous routes data', async () => {
    mockGetBusRouteDetail.mockResolvedValue(detail({ direction: 0, stops: [stop('a', 3)] }));
    const { result, rerender } = await renderHook(({ route }: { route: string }) => useBusRouteDetail(route, 'Taipei'), {
      initialProps: { route: 'A' },
    });
    await act(flushPromises);
    expect(result.current.directions).toHaveLength(1);
    mockGetBusRouteDetail.mockReturnValue(new Promise(() => {}));
    await rerender({ route: 'B' });
    expect(result.current.directions).toEqual([]);
    expect(result.current.loading).toBe(true);
  });

  it('a manual refresh that finishes after the route changed is ignored', async () => {
    mockGetBusRouteDetail.mockResolvedValue(detail({ direction: 0, stops: [stop('a', 3)] }));
    const { result, rerender } = await renderHook(({ route }: { route: string }) => useBusRouteDetail(route, 'Taipei'), {
      initialProps: { route: 'A' },
    });
    await act(flushPromises);
    const late = deferred<unknown>();
    mockGetBusRouteDetail.mockReturnValue(late.promise);
    let refreshing: Promise<void> = Promise.resolve();
    await act(async () => {
      refreshing = result.current.refresh();
    });
    mockGetBusRouteDetail.mockResolvedValue(detail({ direction: 1, stops: [stop('b', 4)] }));
    await rerender({ route: 'B' });
    await act(flushPromises);
    await act(async () => {
      late.resolve(detail({ direction: 0, stops: [stop('stale', 1)] }));
      await refreshing;
    });
    expect(result.current.directions[0]?.stops[0]?.name).toBe('b');
    expect(result.current.refreshing).toBe(false);
  });

  it('a failed update keeps the static stops but drops the old ETA and normal status', async () => {
    mockGetBusRouteDetail.mockResolvedValueOnce(detail({ direction: 0, stops: [stop('a', 3, '正常')] }));
    const { result } = await renderHook(() => useBusRouteDetail('R', 'Taipei'));
    await act(flushPromises);
    expect(result.current.directions[0]?.stops[0]?.estimateMinutes).toBe(3);

    mockGetBusRouteDetail.mockRejectedValueOnce(new Error('network'));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.error).toBe('NETWORK');
    expect(result.current.directions[0]?.stops[0]).toMatchObject({ name: 'a', estimateMinutes: null, statusLabel: '' });
  });

  it('treats an unsuccessful envelope as a failure even if it carries data', async () => {
    mockGetBusRouteDetail.mockResolvedValue({ ok: false, data: { directions: [{ direction: 0, stops: [stop('a', 1)] }] } });
    const { result } = await renderHook(() => useBusRouteDetail('R', 'Taipei'));
    await act(flushPromises);
    expect(result.current.directions).toEqual([]);
    expect(result.current.error).toBe('NO_DATA');
  });
});

describe('useRouteLiveBuses', () => {
  const sel = (direction: RideSelection['direction'], subRouteUid?: string, exclusive = false): RideSelection => ({
    direction,
    subRouteUid,
    exclusive,
  });

  it('queries with the selected direction and keeps only that sub-route and direction', async () => {
    mockGetLiveBusPositions.mockResolvedValue({
      ok: true,
      data: { buses: [bus('A', 10, 'U1'), bus('B', 10, 'U2'), bus('C', 0, 'U1'), bus('D', 10)] },
    });
    const { result } = await renderHook(() => useRouteLiveBuses('R', 'Taipei', sel(10, 'U1')));
    await act(flushPromises);
    expect(mockGetLiveBusPositions.mock.calls[0][0]).toEqual({ routeName: 'R', city: 'Taipei', direction: 10 });
    expect(result.current.buses.map((b) => b.plateNumb)).toEqual(['A']);
    expect(result.current.settled).toBe(true);
  });

  it('shows unknown-direction buses for direction 255 without matching them to a direction', async () => {
    mockGetLiveBusPositions.mockResolvedValue({ ok: true, data: { buses: [bus('U', 255, 'U1'), bus('X', 0, 'U1')] } });
    const { result } = await renderHook(() => useRouteLiveBuses('R', 'Taipei', sel(255, 'U1')));
    await act(flushPromises);
    expect(mockGetLiveBusPositions.mock.calls[0][0].direction).toBe(255);
    expect(result.current.buses.map((b) => b.plateNumb)).toEqual(['U']);
  });

  it('a late response for the previous selection is ignored and never rendered for the new one', async () => {
    const slow = deferred<unknown>();
    const next = deferred<unknown>();
    mockGetLiveBusPositions.mockImplementation((query: { direction: number }) => (query.direction === 0 ? slow.promise : next.promise));
    const { result, rerender } = await renderHook(({ s }: { s: RideSelection }) => useRouteLiveBuses('R', 'Taipei', s), {
      initialProps: { s: sel(0, undefined, true) },
    });
    await rerender({ s: sel(10, undefined, true) });
    expect(result.current).toEqual({ buses: [], settled: false });
    await act(async () => {
      slow.resolve({ ok: true, data: { buses: [bus('OLD', 0)] } });
      await flushPromises();
    });
    expect(result.current).toEqual({ buses: [], settled: false });
    await act(async () => {
      next.resolve({ ok: true, data: { buses: [bus('NEW', 10)] } });
      await flushPromises();
    });
    expect(result.current.buses.map((b) => b.plateNumb)).toEqual(['NEW']);
  });

  it('does not keep the previous positions when the next poll fails', async () => {
    jest.useFakeTimers();
    mockGetLiveBusPositions.mockResolvedValueOnce({ ok: true, data: { buses: [bus('A', 0)] } });
    const { result } = await renderHook(() => useRouteLiveBuses('R', 'Taipei', sel(0, undefined, true)));
    await act(flushPromises);
    expect(result.current.buses.map((b) => b.plateNumb)).toEqual(['A']);
    mockGetLiveBusPositions.mockResolvedValue({ ok: false });
    await act(async () => {
      jest.advanceTimersByTime(30_000);
      await flushPromises();
    });
    expect(result.current).toEqual({ buses: [], settled: true });
  });

  it('does not reuse UID-less buses when another branch makes the direction non-exclusive', async () => {
    mockGetLiveBusPositions.mockResolvedValueOnce({ ok: true, data: { buses: [bus('UNIDENTIFIED', 10)] } });
    const { result, rerender } = await renderHook(({ s }: { s: RideSelection }) => useRouteLiveBuses('R', 'Taipei', s), {
      initialProps: { s: sel(10, 'U1', true) },
    });
    await act(flushPromises);
    expect(result.current.buses).toHaveLength(1);
    mockGetLiveBusPositions.mockReturnValue(new Promise(() => {}));
    await rerender({ s: sel(10, 'U1', false) });
    expect(result.current).toEqual({ buses: [], settled: false });
  });

  it('is idle without a selection', async () => {
    const { result } = await renderHook(() => useRouteLiveBuses('R', 'Taipei', null));
    expect(result.current).toEqual({ buses: [], settled: false });
    expect(mockGetLiveBusPositions).not.toHaveBeenCalled();
  });
});

describe('useTrackedArrival', () => {
  const arrival = (over: object) => ({
    stopName: '站牌',
    direction: 10,
    directionLabel: '',
    estimateMinutes: 4,
    statusLabel: '',
    plateNumb: 'AAA-1',
    subRouteUid: 'U1',
    ...over,
  });

  it('returns the plate and ETA of the same record for the exact stop, sub-route and direction', async () => {
    mockGetBusArrival.mockResolvedValue({
      ok: true,
      data: { arrivals: [arrival({ estimateMinutes: 9, plateNumb: 'LATE' }), arrival({ subRouteUid: 'U2', estimateMinutes: 1, plateNumb: 'OTHER' }), arrival({})] },
    });
    const { result } = await renderHook(() => useTrackedArrival('R', 'Taipei', '站牌', { direction: 10, subRouteUid: 'U1', exclusive: false }));
    await act(flushPromises);
    expect(mockGetBusArrival.mock.calls[0][0]).toEqual({ routeName: 'R', stopName: '站牌', direction: 10, city: 'Taipei' });
    expect(result.current).toEqual({ plateNumb: 'AAA-1', estimateMinutes: 4 });
  });

  it('does not reuse a UID-less arrival after direction exclusivity is lost', async () => {
    mockGetBusArrival.mockResolvedValueOnce({ ok: true, data: { arrivals: [arrival({ subRouteUid: undefined })] } });
    const { result, rerender } = await renderHook(({ exclusive }: { exclusive: boolean }) =>
      useTrackedArrival('R', 'Taipei', '站牌', { direction: 10, subRouteUid: 'U1', exclusive }),
      { initialProps: { exclusive: true } });
    await act(flushPromises);
    expect(result.current?.plateNumb).toBe('AAA-1');
    mockGetBusArrival.mockReturnValue(new Promise(() => {}));
    await rerender({ exclusive: false });
    expect(result.current).toBeNull();
  });

  it('never queries for direction 255 or without a selection', async () => {
    await renderHook(() => useTrackedArrival('R', 'Taipei', '站牌', { direction: 255, exclusive: true }));
    await renderHook(() => useTrackedArrival('R', 'Taipei', '站牌', null));
    expect(mockGetBusArrival).not.toHaveBeenCalled();
  });

  it('returns null after a failure instead of the previous plate', async () => {
    mockGetBusArrival.mockResolvedValue({ ok: true, data: { arrivals: [arrival({})] } });
    const { result, rerender } = await renderHook(({ stopName }: { stopName: string }) =>
      useTrackedArrival('R', 'Taipei', stopName, { direction: 10, subRouteUid: 'U1', exclusive: false }), { initialProps: { stopName: '站牌' } });
    await act(flushPromises);
    expect(result.current?.plateNumb).toBe('AAA-1');
    mockGetBusArrival.mockRejectedValue(new Error('x'));
    await rerender({ stopName: '別站' });
    expect(result.current).toBeNull();
    await act(flushPromises);
    expect(result.current).toBeNull();
  });
});

describe('useStopArrivals', () => {
  const position = { lat: 25, lng: 121 };
  const row = (routeName: string) => ({
    routeName,
    direction: 10,
    headsign: null,
    estimateMinutes: 3,
    statusLabel: '正常',
    plateNumb: 'AAA-1',
    isLowFloor: true,
    hasLiftOrRamp: null,
  });

  it('a transient failure is an error without the previous ETA or plate, not a ready board', async () => {
    mockGetStopArrivals.mockResolvedValueOnce({ ok: true, data: { stopName: 's', city: 'Taipei', arrivals: [row('307')] } });
    const { result } = await renderHook(() => useStopArrivals('s', 'Taipei', position, true));
    await act(flushPromises);
    expect(result.current.status).toBe('ready');
    expect(result.current.arrivals[0]?.direction).toBe(10);

    mockGetStopArrivals.mockRejectedValueOnce(new Error('network'));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.status).toBe('error');
    expect(result.current.arrivals).toEqual([]);
  });

  it('a 404 is unavailable', async () => {
    mockGetStopArrivals.mockRejectedValue(new (jest.requireMock('@/shared/api').ApiError)('nf', 404));
    const { result } = await renderHook(() => useStopArrivals('s', 'Taipei', position, true));
    await act(flushPromises);
    expect(result.current.status).toBe('unavailable');
  });

  it('a manual refresh finishing after the stop changed is ignored', async () => {
    mockGetStopArrivals.mockResolvedValue({ ok: true, data: { stopName: 'a', city: 'Taipei', arrivals: [row('A')] } });
    const { result, rerender } = await renderHook(({ s }: { s: string }) => useStopArrivals(s, 'Taipei', position, true), {
      initialProps: { s: 'a' },
    });
    await act(flushPromises);
    const late = deferred<unknown>();
    mockGetStopArrivals.mockReturnValue(late.promise);
    let refreshing: Promise<void> = Promise.resolve();
    await act(async () => {
      refreshing = result.current.refresh();
    });
    mockGetStopArrivals.mockResolvedValue({ ok: true, data: { stopName: 'b', city: 'Taipei', arrivals: [row('B')] } });
    await rerender({ s: 'b' });
    await act(flushPromises);
    await act(async () => {
      late.resolve({ ok: true, data: { stopName: 'a', city: 'Taipei', arrivals: [row('STALE')] } });
      await refreshing;
    });
    expect(result.current.arrivals.map((a) => a.routeName)).toEqual(['B']);
    expect(result.current.refreshing).toBe(false);
  });

  it('an unsuccessful envelope is not a ready board', async () => {
    mockGetStopArrivals.mockResolvedValue({ ok: false, data: { stopName: 's', city: 'Taipei', arrivals: [row('307')] } });
    const { result } = await renderHook(() => useStopArrivals('s', 'Taipei', position, true));
    await act(flushPromises);
    expect(result.current.status).toBe('error');
  });
});
