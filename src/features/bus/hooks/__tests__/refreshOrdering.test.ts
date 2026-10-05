import { act, renderHook } from '@testing-library/react-native';

import { flushPromises } from '@/shared/testing/flushPromises';

import { useBusRouteDetail } from '../useBusRouteDetail';
import { useStopArrivals } from '../useStopArrivals';

const mockDetail = jest.fn();
const mockArrivals = jest.fn();
jest.mock('../../api/transit', () => ({
  getBusRouteDetail: (...args: unknown[]) => mockDetail(...args),
  getStopArrivals: (...args: unknown[]) => mockArrivals(...args),
}));
jest.mock('@/shared/polling', () => {
  const actual = jest.requireActual('@/shared/polling/poller');
  return {
    createPoller: actual.createPoller,
    appStateVisibility: { isActive: () => true, subscribe: () => () => {} },
  };
});

function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>((r) => { resolve = r; });
  return { promise, resolve };
}

function useRouteSubject() {
  const state = useBusRouteDetail('R', 'Taipei');
  return { tag: state.directions[0]?.stops[0]?.name, eta: state.directions[0]?.stops[0]?.estimateMinutes, refreshing: state.refreshing, refresh: state.refresh };
}
function useStopSubject() {
  const state = useStopArrivals('S', 'Taipei', { lat: 25, lng: 121 }, true);
  return { tag: state.arrivals[0]?.routeName, eta: state.arrivals[0]?.estimateMinutes, refreshing: state.refreshing, refresh: state.refresh };
}

beforeEach(() => {
  mockDetail.mockReset();
  mockArrivals.mockReset();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe.each(['route', 'stop'] as const)('%s same-target refresh ordering', (kind) => {
  const useSubject = kind === 'route' ? useRouteSubject : useStopSubject;
  const api = kind === 'route' ? mockDetail : mockArrivals;
  const payload = (tag: string) => kind === 'route'
    ? { ok: true, data: { directions: [{ direction: 10, stops: [{ seq: 1, name: tag, lat: 25, lng: 121, estimateMinutes: 4, statusLabel: '正常' }] }] } }
    : { ok: true, data: { arrivals: [{ routeName: tag, direction: 10, estimateMinutes: 4, statusLabel: '正常', headsign: null, isLowFloor: null, hasLiftOrRamp: null }] } };

  it('an older poll cannot overwrite a newer completed manual refresh', async () => {
    const oldPoll = deferred();
    api.mockReturnValueOnce(oldPoll.promise).mockResolvedValue(payload('NEW'));
    const { result } = await renderHook(useSubject);
    await act(async () => { await result.current.refresh(); });
    expect(result.current.tag).toBe('NEW');
    await act(async () => { oldPoll.resolve(payload('OLD')); await flushPromises(); });
    expect(result.current.tag).toBe('NEW');
  });

  it.each([true, false])('an older manual refresh cannot overwrite a newer poll (success=%p)', async (success) => {
    api.mockResolvedValueOnce(payload('SEED'));
    const { result } = await renderHook(useSubject);
    await act(flushPromises);
    const oldManual = deferred();
    api.mockReturnValueOnce(oldManual.promise).mockResolvedValue(success ? payload('NEW') : { ok: false });
    let refresh = Promise.resolve();
    await act(async () => { refresh = result.current.refresh(); });
    expect(result.current.refreshing).toBe(true);
    await act(async () => { jest.advanceTimersByTime(30_000); await flushPromises(); });
    const latestTag = result.current.tag;
    if (success) expect(latestTag).toBe('NEW');
    else expect(result.current.eta == null).toBe(true);
    await act(async () => { oldManual.resolve(payload('OLD')); await refresh; });
    expect(result.current.tag).toBe(latestTag);
    expect(result.current.refreshing).toBe(false);
  });
});
