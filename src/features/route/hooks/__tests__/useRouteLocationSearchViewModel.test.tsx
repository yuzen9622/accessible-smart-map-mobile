import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';

import { useSavedPlacesStore, type AutocompleteItem, type PlaceDetail, type PlaceResult } from '@/features/place';
import { getPlaceAutocomplete, getPlaceDetails } from '@/features/place/api/placeSearch';
import { loadPersistedPlaceState } from '@/features/place/store/persistence';

import { changeAppLanguage } from '@/shared/i18n';
import { loadVenue, loadVenues } from '@/features/indoor/api/venueApi';
import { createVenueDetail } from '@/features/indoor/domain/fixtures/venueFixture';
import { toVenuePlaceDetail } from '@/features/place/domain/venuePlace';
import { refreshVenuePlaceCatalog } from '@/features/place/hooks/venuePlaceCatalog';

import RouteLocationSearchPanel from '../../components/RouteLocationSearchPanel';
import { useRouteSessionStore } from '../../store/routeSessionStore';
import { useRouteLocationSearchViewModel } from '../useRouteLocationSearchViewModel';

jest.mock('@/features/map', () => jest.requireActual('@/features/navigation/controller/testing/fakeMap').mapModule);
jest.mock('@/features/place/api/placeSearch', () => ({ getPlaceAutocomplete: jest.fn(), getPlaceDetails: jest.fn() }));
jest.mock('@/features/indoor/api/venueApi', () => ({ loadVenue: jest.fn(), loadVenues: jest.fn() }));
jest.mock('@/shared/ui', () => ({ Icon: () => null }));

const station: PlaceDetail = { kind: 'coordinate', address: '台北車站', position: { lat: 25.047, lng: 121.517 } };
const park: PlaceDetail = { kind: 'coordinate', address: '大安森林公園', position: { lat: 25.031, lng: 121.535 } };
const suggestion: AutocompleteItem = {
  id: 'google:101', source: 'google', primaryText: '台北101', secondaryText: '信義路五段7號',
  location: { type: 'Point', coordinates: [121.565, 25.034] },
  placeClass: null, placeType: null, typeLabel: null, distanceMeters: null,
};
const response = (items: AutocompleteItem[]) => ({ ok: true as const, status: 'success' as const, code: 200, message: '', data: items });
const close = jest.fn();

beforeEach(async () => {
  await changeAppLanguage('zh-TW');
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(loadVenues).mockResolvedValue([]);
  jest.mocked(loadVenue).mockResolvedValue(createVenueDetail());
  await refreshVenuePlaceCatalog();
  useSavedPlacesStore.getState().clearSearchHistory();
  useSavedPlacesStore.getState().addSearchHistory(park);
  useSavedPlacesStore.getState().addSearchHistory(station);
  useRouteSessionStore.getState().setOrigin(null);
  useRouteSessionStore.getState().setDestination(null);
  jest.mocked(getPlaceAutocomplete).mockResolvedValue(response([suggestion]));
});
afterEach(() => jest.useRealTimers());

it.each(['origin', 'destination'] as const)('shows shared history immediately for %s, without input or a network request', async (field) => {
  const { result } = await renderHook(() => useRouteLocationSearchViewModel(field, close));
  expect(result.current.labels.title).toBe(field === 'origin' ? '選擇起點' : '選擇終點');
  expect(result.current.query).toBe('');
  expect(result.current.rows.map((row) => row.title)).toEqual(['台北車站', '大安森林公園']);
  expect(result.current.loading).toBe(false);
  expect(getPlaceAutocomplete).not.toHaveBeenCalled();
});

it.each(['origin', 'destination'] as const)('selects history as %s, persists recency and leaves the other endpoint unchanged', async (field) => {
  const { result } = await renderHook(() => useRouteLocationSearchViewModel(field, close));
  await act(() => result.current.rows[1].onPress());
  expect(useRouteSessionStore.getState()[field]).toEqual(park.position);
  expect(useRouteSessionStore.getState()[field === 'origin' ? 'destination' : 'origin']).toBeNull();
  expect(loadPersistedPlaceState().searchHistory).toEqual([park, station]);
  expect(close).toHaveBeenCalledTimes(1);
  expect(getPlaceDetails).not.toHaveBeenCalled();
});

it('finishes a history selection only once even when tapped repeatedly', async () => {
  const { result } = await renderHook(() => useRouteLocationSearchViewModel('destination', close));
  await act(() => { result.current.rows[0].onPress(); result.current.rows[1].onPress(); result.current.onClose(); });
  expect(useRouteSessionStore.getState().destination).toEqual(station.position);
  expect(close).toHaveBeenCalledTimes(1);
});

it('shows an explicit empty-history state', async () => {
  useSavedPlacesStore.getState().clearSearchHistory();
  const { result } = await renderHook(() => useRouteLocationSearchViewModel('destination', close));
  expect(result.current.rows).toEqual([]);
  expect(result.current.labels.empty).toContain('尚無搜尋紀錄');
  expect(result.current.loading).toBe(false);
});

it('cancels without changing either endpoint or history', async () => {
  const { result } = await renderHook(() => useRouteLocationSearchViewModel('destination', close));
  await act(() => { result.current.onQueryChange('unsaved'); result.current.onClose(); });
  expect(useRouteSessionStore.getState().destination).toBeNull();
  expect(loadPersistedPlaceState().searchHistory).toEqual([station, park]);
  expect(close).toHaveBeenCalledTimes(1);
});

it('uses the current location only for origin without adding a fake history entry', async () => {
  useRouteSessionStore.getState().setOrigin(park.position, park.address);
  const { result } = await renderHook(() => useRouteLocationSearchViewModel('origin', close));
  await act(() => result.current.onUseMyLocation?.());
  expect(useRouteSessionStore.getState().origin).toBeNull();
  expect(loadPersistedPlaceState().searchHistory).toEqual([station, park]);
  const destination = await renderHook(() => useRouteLocationSearchViewModel('destination', close));
  expect(destination.result.current.onUseMyLocation).toBeNull();
});

it('renders tappable history before typing, then suggestions, and saves the selected point', async () => {
  function Search() {
    const model = useRouteLocationSearchViewModel('destination', close);
    return <RouteLocationSearchPanel model={model} />;
  }
  await render(<Search />);
  expect(screen.getByText('最近搜尋')).toBeTruthy();
  expect(screen.getByRole('button', { name: '台北車站' })).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('搜尋地點或地址'), '101');
  expect(screen.queryByText('搜尋中…')).toBeNull();
  expect(screen.getByLabelText('搜尋中…')).toBeTruthy();
  await act(async () => jest.advanceTimersByTime(400));
  expect(screen.getByText('搜尋建議')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '台北101，信義路五段7號' }));
  expect(useRouteSessionStore.getState().destination).toEqual({ lat: 25.034, lng: 121.565 });
  expect(loadPersistedPlaceState().searchHistory[0]).toEqual({ kind: 'coordinate', address: '台北101', position: { lat: 25.034, lng: 121.565 } });
  expect(close).toHaveBeenCalledTimes(1);
});

it('hides stale suggestions during debounce and returns to history immediately after clearing', async () => {
  const { result } = await renderHook(() => useRouteLocationSearchViewModel('destination', close));
  await act(() => result.current.onQueryChange('101'));
  await act(async () => jest.advanceTimersByTime(400));
  expect(result.current.rows[0].title).toBe('台北101');
  await act(() => result.current.onQueryChange('different'));
  expect(result.current.loading).toBe(true);
  expect(result.current.rows).toEqual([]);
  await act(() => result.current.onQueryChange(''));
  expect(result.current.rows.map((row) => row.title)).toEqual(['台北車站', '大安森林公園']);
  expect(result.current.loading).toBe(false);
});

it('reuses the autocomplete token for details and ignores a response after dismissal', async () => {
  jest.mocked(getPlaceAutocomplete).mockResolvedValue(response([{ ...suggestion, location: null }]));
  let resolve: (value: Awaited<ReturnType<typeof getPlaceDetails>>) => void = () => {};
  jest.mocked(getPlaceDetails).mockImplementation(() => new Promise((done) => { resolve = done; }));
  const { result } = await renderHook(() => useRouteLocationSearchViewModel('destination', close));
  await act(() => result.current.onQueryChange('101'));
  await act(async () => jest.advanceTimersByTime(400));
  await act(() => { result.current.rows[0].onPress(); result.current.rows[0].onPress(); });
  expect(getPlaceDetails).toHaveBeenCalledTimes(1);
  expect(jest.mocked(getPlaceDetails).mock.calls[0][1]?.sessiontoken).toBe(jest.mocked(getPlaceAutocomplete).mock.calls[0][0].sessiontoken);
  await act(() => result.current.onDismiss());
  expect(jest.mocked(getPlaceDetails).mock.calls[0][2]?.aborted).toBe(true);
  await act(() => resolve({ ok: true, status: 'success', code: 200, message: '', data: { name: '台北101', location: suggestion.location } as PlaceResult }));
  expect(useRouteSessionStore.getState().destination).toBeNull();
  expect(loadPersistedPlaceState().searchHistory).toEqual([station, park]);
  expect(close).not.toHaveBeenCalled();
});

it('keeps resolution failures in the sheet and allows selecting again', async () => {
  jest.mocked(getPlaceAutocomplete).mockResolvedValue(response([{ ...suggestion, location: null }]));
  jest.mocked(getPlaceDetails).mockRejectedValueOnce(new Error('offline'));
  const { result } = await renderHook(() => useRouteLocationSearchViewModel('origin', close));
  await act(() => result.current.onQueryChange('101'));
  await act(async () => jest.advanceTimersByTime(400));
  await act(() => result.current.rows[0].onPress());
  expect(result.current.error).toContain('無法取得');
  expect(result.current.resolving).toBe(false);
  expect(close).not.toHaveBeenCalled();
  expect(useRouteSessionStore.getState().origin).toBeNull();
  await act(() => result.current.onQueryChange(''));
  await act(() => result.current.rows[0].onPress());
  expect(useRouteSessionStore.getState().origin).toEqual(station.position);
  expect(close).toHaveBeenCalledTimes(1);
});

it('distinguishes network errors from no results and retries the same query', async () => {
  jest.mocked(getPlaceAutocomplete).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response([]));
  const { result } = await renderHook(() => useRouteLocationSearchViewModel('destination', close));
  await act(() => result.current.onQueryChange('missing'));
  await act(async () => jest.advanceTimersByTime(400));
  expect(result.current.error).toContain('連線失敗');
  await act(() => result.current.onRetry());
  await act(async () => jest.advanceTimersByTime(400));
  expect(result.current.error).toBeNull();
  expect(result.current.rows).toEqual([]);
  expect(result.current.labels.empty).toContain('找不到');
  expect(close).not.toHaveBeenCalled();
});

it.each(['origin', 'destination'] as const)('keeps fresh venue identity when choosing an indoor history item as %s', async (field) => {
  const detail = createVenueDetail();
  useSavedPlacesStore.getState().addSearchHistory(toVenuePlaceDetail(detail, detail.places[1]));
  const latest = createVenueDetail(); latest.version = 4;
  jest.mocked(loadVenue).mockResolvedValue(latest);
  const { result } = await renderHook(() => useRouteLocationSearchViewModel(field, close));
  expect(result.current.rows[0].subtitle).toBe('測試館・2F');
  await act(async () => result.current.rows[0].onPress());
  expect(useRouteSessionStore.getState()[field === 'origin' ? 'originVenuePlace' : 'destinationVenuePlace']).toMatchObject({
    venueId: 'test-venue', placeId: 'end', buildingId: 'a', levelRef: '2F', sourceVersion: 4,
  });
  expect(loadPersistedPlaceState().searchHistory[0]).toMatchObject({ kind: 'venue-place', placeId: 'end', sourceVersion: 4 });
  expect(getPlaceDetails).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledTimes(1);
});

it('mixes rooms with ordinary endpoint suggestions and does not commit removed indoor history', async () => {
  const detail = createVenueDetail();
  jest.mocked(loadVenues).mockResolvedValue([{ ...detail, buildings: detail.buildings.map(({ id, name }) => ({ id, name })) }]);
  await refreshVenuePlaceCatalog();
  const { result } = await renderHook(() => useRouteLocationSearchViewModel('destination', close));
  await act(() => result.current.onQueryChange('空間'));
  await act(async () => jest.advanceTimersByTime(400));
  expect(result.current.rows.map((row) => row.title)).toEqual(['起點空間', '終點空間', '台北101']);
  jest.mocked(loadVenue).mockResolvedValue({ ...detail, version: 4, places: [] });
  await act(async () => result.current.rows[1].onPress());
  expect(result.current.error).toBe('此地點資料已更新，請重新搜尋。');
  expect(useRouteSessionStore.getState().destinationVenuePlace).toBeNull();
  expect(close).not.toHaveBeenCalled();
});

it('does not change an endpoint when an indoor resolution finishes after dismissal', async () => {
  const detail = createVenueDetail();
  useSavedPlacesStore.getState().addSearchHistory(toVenuePlaceDetail(detail, detail.places[1]));
  const historyBefore = loadPersistedPlaceState().searchHistory;
  let finish: (value: typeof detail) => void = () => {};
  jest.mocked(loadVenue).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const { result } = await renderHook(() => useRouteLocationSearchViewModel('destination', close));
  await act(() => result.current.rows[0].onPress());
  const signal = jest.mocked(loadVenue).mock.calls.at(-1)?.[1];
  await act(() => result.current.onDismiss());
  expect(signal?.aborted).toBe(true);
  await act(async () => finish({ ...detail, version: 4 }));
  expect(useRouteSessionStore.getState().destinationVenuePlace).toBeNull();
  expect(loadPersistedPlaceState().searchHistory).toEqual(historyBefore);
  expect(close).not.toHaveBeenCalled();
});
