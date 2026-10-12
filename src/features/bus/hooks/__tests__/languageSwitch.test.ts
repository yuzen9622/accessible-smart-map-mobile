import { act, renderHook } from '@testing-library/react-native';
import { flushPromises } from '@/shared/testing/flushPromises';
import { useBusSearch } from '../useBusSearch';
import { useNearbyBusStops } from '../useNearbyBusStops';
import { useBusRouteDetail } from '../useBusRouteDetail';
import { useStopArrivals } from '../useStopArrivals';

let mockLanguage = 'zh-TW';
jest.mock('@/shared/i18n', () => ({ getAppLanguage: () => mockLanguage, useAppTranslation: () => ({ i18n: { language: mockLanguage } }) }));
const mockSearch = jest.fn();
const mockNearby = jest.fn();
const mockDetail = jest.fn();
const mockArrivals = jest.fn();
jest.mock('../../api/transit', () => ({ searchBusRoutes: (...args: unknown[]) => mockSearch(...args), getNearbyBusStops: (...args: unknown[]) => mockNearby(...args), getBusRouteDetail: (...args: unknown[]) => mockDetail(...args), getStopArrivals: (...args: unknown[]) => mockArrivals(...args) }));
jest.mock('@/shared/polling', () => ({ createPoller: jest.requireActual('@/shared/polling/poller').createPoller, appStateVisibility: { isActive: () => true, subscribe: () => () => {} } }));
const envelope = (data: unknown) => ({ ok: true, data });
const deferred = () => { let resolve!: (value: unknown) => void; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function settle() { await act(() => { jest.advanceTimersByTime(400); }); await act(flushPromises); }
beforeEach(() => { mockLanguage = 'zh-TW'; jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'] }); jest.clearAllMocks(); });
afterEach(() => jest.useRealTimers());

it('search switches language with the same canonical keyword and ignores a late old response', async () => {
  const old = deferred();
  mockSearch.mockReturnValueOnce(old.promise).mockResolvedValue(envelope({ routes: [{ routeName: '99', routeDisplayName: 'English' }] }));
  const { result, rerender } = await renderHook(() => useBusSearch('99', 'route'));
  await settle(); mockLanguage = 'en'; await rerender({});
  expect(result.current.results).toEqual([]); await settle();
  expect(mockSearch.mock.calls.map(c => [c[0], c[3]])).toEqual([['99', 'zh-TW'], ['99', 'en']]);
  await act(() => old.resolve(envelope({ routes: [{ routeName: '99', routeDisplayName: '舊' }] })));
  expect(result.current.results).toEqual([{ routeName: '99', routeDisplayName: 'English' }]);
});

it('nearby refetches at identical coordinates and drops late old-language data', async () => {
  const old = deferred();
  const position = { lat: 25, lng: 121 };
  mockNearby.mockReturnValueOnce(old.promise).mockResolvedValue(envelope({ stops: [{ stopUid: 'id', stopName: '站', stopDisplayName: 'Stop' }] }));
  const { result, rerender } = await renderHook(() => useNearbyBusStops(position, true));
  await settle(); mockLanguage = 'en'; await rerender({}); await settle();
  await act(() => old.resolve(envelope({ stops: [{ stopUid: 'old', stopName: '站' }] })));
  expect(mockNearby.mock.calls.map(c => c[2])).toEqual(['zh-TW', 'en']);
  expect(result.current.stops).toEqual([{ stopUid: 'id', stopName: '站', stopDisplayName: 'Stop' }]);
});

it('route detail and stop arrivals restart polling and reject old locale responses', async () => {
  const detailOld = deferred(); const arrivalsOld = deferred();
  const stop = { seq: 1, name: '站', displayName: 'Stop', lat: 25, lng: 121 };
  mockDetail.mockReturnValueOnce(detailOld.promise).mockResolvedValue(envelope({ directions: [{ direction: 0, stops: [stop] }] }));
  mockArrivals.mockReturnValueOnce(arrivalsOld.promise).mockResolvedValue(envelope({ stopDisplayName: 'Stop', arrivals: [{ routeName: '99', routeDisplayName: 'Route' }] }));
  const { result, rerender } = await renderHook(() => ({ detail: useBusRouteDetail('99', 'Taipei'), board: useStopArrivals('站', 'Taipei', { lat: 25, lng: 121 }, true) }));
  await settle(); mockLanguage = 'en'; await rerender({}); await settle();
  await act(() => { detailOld.resolve(envelope({ directions: [{ direction: 0, stops: [] }] })); arrivalsOld.resolve(envelope({ arrivals: [] })); });
  expect(result.current.detail.directions[0].stops).toEqual([stop]);
  expect(result.current.board.stopDisplayName).toBe('Stop');
  expect(result.current.board.arrivals).toHaveLength(1);
  expect(mockDetail.mock.calls.map(c => [c[0], c[5]])).toEqual([['99', 'zh-TW'], ['99', 'en']]);
  expect(mockArrivals.mock.calls.map(c => [c[0].stopName, c[2]])).toEqual([['站', 'zh-TW'], ['站', 'en']]);
});
