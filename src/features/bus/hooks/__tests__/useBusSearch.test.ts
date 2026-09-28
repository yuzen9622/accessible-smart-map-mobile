import { act, renderHook } from '@testing-library/react-native';

import { BUS_SEARCH_NO_DATA, useBusSearch, type BusSearchMode } from '../useBusSearch';
import { flushPromises } from '@/shared/testing/flushPromises';

const mockSearchBusRoutes = jest.fn();
const mockSearchBusStops = jest.fn();
jest.mock('../../api/transit', () => ({
  searchBusRoutes: (...args: unknown[]) => mockSearchBusRoutes(...args),
  searchBusStops: (...args: unknown[]) => mockSearchBusStops(...args),
}));

function envelope(data: unknown) {
  return { ok: true, status: 'success', code: 200, message: 'success', data };
}

async function settle(ms = 400): Promise<void> {
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
  await act(flushPromises);
}

beforeEach(() => {
  // React 19 的 act 靠 microtask 排程；只假計時器，不假 microtask。
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'] });
  mockSearchBusRoutes.mockReset();
  mockSearchBusStops.mockReset();
});
afterEach(() => jest.useRealTimers());

describe('useBusSearch', () => {
  it('debounces, then returns route results', async () => {
    mockSearchBusRoutes.mockResolvedValue(envelope({ routes: [{ routeName: '307', city: 'Taipei' }] }));
    const { result } = await renderHook(() => useBusSearch('307', 'route'));
    expect(result.current.loading).toBe(true);
    await settle(399);
    expect(mockSearchBusRoutes).not.toHaveBeenCalled();
    await settle(1);
    expect(result.current).toMatchObject({ mode: 'route', loading: false, error: null });
    expect(result.current.results).toHaveLength(1);
  });

  it('clears stale results the moment the keyword changes and cancels the old request', async () => {
    mockSearchBusRoutes.mockResolvedValue(envelope({ routes: [{ routeName: '307', city: 'Taipei' }] }));
    const { result, rerender } = await renderHook(({ q }: { q: string }) => useBusSearch(q, 'route'), {
      initialProps: { q: '307' },
    });
    await settle();
    expect(result.current.results).toHaveLength(1);

    await rerender({ q: '26' });
    expect(result.current).toMatchObject({ results: [], loading: true });
  });

  it('reports a shape problem as NO_DATA, never the envelope message', async () => {
    // API 層的 parser 認不得回應形狀時，會回傳成功信封但 data 為 undefined。
    mockSearchBusStops.mockResolvedValue(envelope(undefined));
    const mode: BusSearchMode = 'stop';
    const { result } = await renderHook(() => useBusSearch('公園', mode));
    await settle();
    expect(result.current.error).toBe(BUS_SEARCH_NO_DATA);
  });

  it('does nothing for a blank keyword', async () => {
    const { result } = await renderHook(() => useBusSearch('   ', 'route'));
    await settle();
    expect(mockSearchBusRoutes).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ results: [], loading: false, error: null });
  });

  it('does not search again for sub-100 m location jitter', async () => {
    mockSearchBusRoutes.mockResolvedValue(envelope({ routes: [] }));
    const { rerender } = await renderHook(
      ({ lat }: { lat: number }) => useBusSearch('307', 'route', { lat, lng: 121.5 }),
      { initialProps: { lat: 25.03312 } },
    );
    await settle();
    await rerender({ lat: 25.03318 });
    await settle();
    expect(mockSearchBusRoutes).toHaveBeenCalledTimes(1);
  });

  it('reports failures as codes the UI can translate', async () => {
    mockSearchBusRoutes.mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    const { result, rerender } = await renderHook(({ q }: { q: string }) => useBusSearch(q, 'route'), {
      initialProps: { q: '307' },
    });
    await settle();
    expect(result.current.error).toBe('TIMEOUT');

    mockSearchBusRoutes.mockRejectedValue(new Error('Network request failed'));
    await rerender({ q: '26' });
    await settle();
    expect(result.current.error).toBe('NETWORK');
  });
});
