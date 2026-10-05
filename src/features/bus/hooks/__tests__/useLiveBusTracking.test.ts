import { act, renderHook } from '@testing-library/react-native';
import { create } from 'zustand';

import type { AccessibleRoute, BusLeg } from '@/features/route/domain';

import { busLegKey, useBusStore } from '../../store/busStore';
import { useLiveBusTracking } from '../useLiveBusTracking';
import { flushPromises } from '@/shared/testing/flushPromises';

const mockFetchLeg = jest.fn();
const mockFetchRideArrival = jest.fn();
jest.mock('../../controller/liveBusTracker', () => ({
  fetchLegSnapshot: (...args: unknown[]) => mockFetchLeg(...args),
  fetchRideArrival: (...args: unknown[]) => mockFetchRideArrival(...args),
  tdxRouteName: (leg: { routeName: string }) => leg.routeName,
}));
jest.mock('@/shared/polling', () => {
  const actual = jest.requireActual('@/shared/polling/poller');
  return {
    createPoller: actual.createPoller,
    appStateVisibility: { isActive: () => true, subscribe: () => () => {} },
  };
});

interface MockRouteState {
  selectRoute: { index: number; route: AccessibleRoute } | null;
}
const mockRouteStore = create<MockRouteState>()(() => ({ selectRoute: null }));
jest.mock('@/features/route', () => ({
  useRouteSession: <T,>(selector: (s: MockRouteState) => T) => mockRouteStore(selector),
}));

function busLeg(routeName: string, departureStop = 'A'): BusLeg {
  return {
    type: 'BUS',
    routeName,
    direction: 0,
    departureStop,
    arrivalStop: 'B',
    tdxCity: 'Taipei',
    waitInfo: { time: null, source: 'unavailable' },
    estimatedWaitMinutes: 0,
    polyline: [],
    departureStopA11y: [],
    arrivalStopA11y: [],
  };
}

function route(routeId: string, leg: BusLeg): AccessibleRoute {
  return { routeId, routeName: routeId, totalMinutes: 10, transferCount: 0, legs: [leg], accessibilityHighlights: [] };
}

async function flush(): Promise<void> {
  await flushPromises();
}

beforeEach(() => {
  // React 19 的 act 靠 microtask 排程；只假計時器，不假 microtask。
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'] });
  mockFetchLeg.mockReset();
  mockFetchLeg.mockResolvedValue({ buses: [{ plateNumb: 'KKA-1234' }], arrival: { eta: 4, plate: 'KKA-1234' } });
  mockFetchRideArrival.mockReset();
  useBusStore.setState({ activeBusLeg: null, liveBusPositions: [], legArrival: null });
  mockRouteStore.setState({ selectRoute: null });
});
afterEach(() => jest.useRealTimers());

function activate(r: AccessibleRoute) {
  const leg = r.legs[0] as BusLeg;
  mockRouteStore.setState({ selectRoute: { index: 0, route: r } });
  useBusStore.getState().setActiveBusLeg({ key: busLegKey(r, 0, 0, leg), leg, route: r });
}

describe('useLiveBusTracking', () => {
  it('makes no requests until a leg is expanded', async () => {
    await renderHook(() => useLiveBusTracking());
    await act(flush);
    expect(mockFetchLeg).not.toHaveBeenCalled();
  });

  it('polls the expanded leg and publishes the tracked bus', async () => {
    const r = route('r1', busLeg('307'));
    activate(r);
    await renderHook(() => useLiveBusTracking());
    await act(flush);
    expect(mockFetchLeg.mock.calls[0][0].routeName).toBe('307');
    expect(useBusStore.getState().liveBusPositions).toEqual([{ plateNumb: 'KKA-1234' }]);
    expect(useBusStore.getState().legArrival).toEqual({ stop: 'board', eta: 4 });
  });

  it('after boarding stops tracking vehicles and polls only the boarded bus to the alighting stop', async () => {
    const r = route('r1', busLeg('307'));
    activate(r);
    mockFetchRideArrival.mockResolvedValue(7);
    await renderHook(() => useLiveBusTracking());
    await act(flush);
    const before = mockFetchLeg.mock.calls.length;

    await act(async () => {
      useBusStore.getState().markBoarded(useBusStore.getState().activeBusLeg?.key ?? '', 'KKA-1234');
      await flush();
    });
    expect(useBusStore.getState().liveBusPositions).toEqual([]);
    expect(mockFetchRideArrival).toHaveBeenCalledWith(expect.objectContaining({ routeName: '307' }), 'KKA-1234', expect.anything());
    expect(useBusStore.getState().legArrival).toEqual({ stop: 'alight', eta: 7 });

    await act(() => {
      jest.advanceTimersByTime(15_000);
    });
    await act(flush);
    expect(mockFetchLeg.mock.calls.length).toBe(before);
  });

  it('boarded without a locked plate makes no further requests', async () => {
    activate(route('r1', busLeg('307')));
    await renderHook(() => useLiveBusTracking());
    await act(flush);
    const before = mockFetchLeg.mock.calls.length;
    await act(async () => {
      useBusStore.getState().markBoarded(useBusStore.getState().activeBusLeg?.key ?? '', null);
      await flush();
    });
    await act(() => {
      jest.advanceTimersByTime(60_000);
    });
    await act(flush);
    expect(mockFetchLeg.mock.calls.length).toBe(before);
    expect(mockFetchRideArrival).not.toHaveBeenCalled();
    expect(useBusStore.getState().legArrival).toEqual({ stop: 'alight', eta: null });
  });

  it('switching to another leg drops the previous leg vehicles and minutes at once', () => {
    activate(route('r1', busLeg('307')));
    useBusStore.setState({ liveBusPositions: [{ plateNumb: 'OLD', direction: 0, lat: 25, lng: 121.5, speed: 0, gpsTime: '', isLowFloor: '是', hasLiftOrRamp: '是', vehicleClass: '' }], legArrival: { stop: 'board', eta: 3 } });
    activate(route('r2', busLeg('307')));
    expect(useBusStore.getState().liveBusPositions).toEqual([]);
    expect(useBusStore.getState().legArrival).toBeNull();
  });

  it('ignores a boarding mark for a leg that is no longer active', async () => {
    activate(route('r1', busLeg('307')));
    useBusStore.getState().markBoarded('stale-key', 'KKA-1234');
    expect(useBusStore.getState().activeBusLeg?.boarded).toBeUndefined();
  });

  it('drops the tracked leg when a new route replaces the selection at the same index', async () => {
    const first = route('r1', busLeg('307'));
    activate(first);
    await renderHook(() => useLiveBusTracking());
    await act(flush);

    // 重新規劃：選中的仍是 index 0，但已是另一個路線物件。
    await act(async () => {
      mockRouteStore.setState({ selectRoute: { index: 0, route: route('r2', busLeg('307')) } });
      await flush();
    });
    expect(useBusStore.getState().activeBusLeg).toBeNull();
    expect(useBusStore.getState().liveBusPositions).toEqual([]);
  });

  it('gives a different leg at the same position a different key', () => {
    const a = route('r1', busLeg('307'));
    const b = route('r2', busLeg('307'));
    expect(busLegKey(a, 0, 0, a.legs[0] as BusLeg)).not.toBe(busLegKey(b, 0, 0, b.legs[0] as BusLeg));
    const c = route('r1', busLeg('307', 'C'));
    expect(busLegKey(a, 0, 0, a.legs[0] as BusLeg)).not.toBe(busLegKey(c, 0, 0, c.legs[0] as BusLeg));
  });

  it('reads the latest leg every round instead of the one it started with', async () => {
    const r = route('r1', busLeg('307'));
    activate(r);
    await renderHook(() => useLiveBusTracking());
    await act(flush);

    // 同一個 key 下換成新的 leg 物件（例如路線資料刷新）：下一輪要用新的。
    const refreshed = { ...(r.legs[0] as BusLeg), subRouteUid: 'TPE307A' };
    useBusStore.setState({ activeBusLeg: { key: useBusStore.getState().activeBusLeg?.key ?? '', leg: refreshed, route: r } });
    await act(() => {
      jest.advanceTimersByTime(15_000);
    });
    await act(flush);
    expect(mockFetchLeg.mock.calls.at(-1)?.[0].subRouteUid).toBe('TPE307A');
  });

  it('stops polling and clears positions on unmount', async () => {
    activate(route('r1', busLeg('307')));
    const { unmount } = await renderHook(() => useLiveBusTracking());
    await act(flush);
    await unmount();
    expect(useBusStore.getState().liveBusPositions).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
  });
});
