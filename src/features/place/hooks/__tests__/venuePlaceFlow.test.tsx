import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';

import { loadVenue, loadVenues } from '@/features/indoor/api/venueApi';
import { createVenueDetail } from '@/features/indoor/domain/fixtures/venueFixture';
import { mapCamera } from '@/features/map';

import { getPlaceAutocomplete, getPlaceDetails } from '../../api/placeSearch';
import { venuePlaceId } from '../../domain/venuePlace';
import { usePlaceUiStore } from '../../store/placeUiStore';
import { useSavedPlacesStore } from '../../store/savedPlacesStore';
import type { AutocompleteItem } from '../../types/place';
import { useExploreViewModel } from '../useExploreViewModel';
import { useVenuePlaceDetail } from '../useVenuePlaceDetail';
import { refreshVenuePlaceCatalog, resolveVenuePlace, venuePlaceCatalog } from '../venuePlaceCatalog';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('@/features/indoor/api/venueApi', () => ({ loadVenue: jest.fn(), loadVenues: jest.fn() }));
jest.mock('../../api/placeSearch', () => ({ getPlaceAutocomplete: jest.fn(), getPlaceDetails: jest.fn() }));
jest.mock('@/features/auth', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: null }),
  selectIsLoggedIn: () => false, selectAvatarUrl: () => null,
}));
jest.mock('@/features/onboarding', () => ({
  useOnboardingStore: (selector: (state: unknown) => unknown) => selector({ profile: { routeMode: 'wheelchair' } }),
  ROUTE_MODE_LABEL_KEY: { wheelchair: 'routeModeWheelchair' },
}));
jest.mock('@/features/map', () => ({
  ...jest.requireActual('@/features/navigation/controller/testing/fakeMap').mapModule,
  ...jest.requireActual('@/features/map/domain/facilities'),
  FACILITY_COLORS: {}, SHEET_DETENTS: [0.2, 0.5, 1],
  mapCamera: { flyTo: jest.fn() },
  sheetController: { raiseTo: jest.fn(), collapse: jest.fn() },
  useNearbySummary: () => null,
  useFacilityStore: (selector: (state: unknown) => unknown) => selector({ showParking: false, selected: [], toggleCategory: jest.fn(), toggleParking: jest.fn() }),
}));
jest.mock('@/shared/speech', () => ({ useDictation: () => ({ status: 'idle', start: jest.fn(), stop: jest.fn(), cancel: jest.fn() }) }));

const outdoor: AutocompleteItem = {
  id: 'osm:node:123', source: 'osm', primaryText: '戶外公園', secondaryText: '臺中市',
  placeClass: null, placeType: null, typeLabel: null, distanceMeters: null,
  location: { type: 'Point', coordinates: [121, 25] },
};
const response = (items: AutocompleteItem[]) => ({ ok: true as const, status: 'success' as const, code: 200, message: '', data: items });

beforeEach(async () => {
  jest.useFakeTimers(); jest.clearAllMocks();
  useSavedPlacesStore.getState().clearSearchHistory();
  usePlaceUiStore.getState().setSelectedPlace(null);
  jest.mocked(loadVenues).mockResolvedValue([]);
  await refreshVenuePlaceCatalog();
  jest.mocked(loadVenue).mockResolvedValue(createVenueDetail());
  jest.mocked(getPlaceAutocomplete).mockResolvedValue(response([outdoor]));
});
afterEach(async () => { await act(async () => { jest.runOnlyPendingTimers(); }); jest.useRealTimers(); });

async function publishVenue() {
  const detail = createVenueDetail();
  jest.mocked(loadVenues).mockResolvedValue([{ ...detail, buildings: detail.buildings.map(({ id, name }) => ({ id, name })) }]);
  await act(async () => { await refreshVenuePlaceCatalog(); });
}

it('mixes room and outdoor results in the main search and opens fresh venue identity on the existing place route', async () => {
  await publishVenue();
  const { result } = await renderHook(() => useExploreViewModel());
  await act(() => result.current.onQueryChange('空間'));
  await act(async () => jest.advanceTimersByTime(400));
  expect(result.current.resultRows.map((row) => row.title)).toEqual(['起點空間', '終點空間', '戶外公園']);
  const latest = createVenueDetail(); latest.version = 4;
  jest.mocked(loadVenue).mockResolvedValue(latest);
  await act(async () => { result.current.resultRows[1].onPress(); });
  expect(usePlaceUiStore.getState().selectedPlace).toMatchObject({ kind: 'venue-place', venueId: 'test-venue', placeId: 'end', buildingId: 'a', levelRef: '2F', sourceVersion: 4 });
  expect(useSavedPlacesStore.getState().searchHistory[0]).toMatchObject({ kind: 'venue-place', placeId: 'end', sourceVersion: 4 });
  expect(router.navigate).toHaveBeenCalledWith({ pathname: '/place/[id]', params: { id: 'venue:test-venue:end' } });
  expect(getPlaceDetails).not.toHaveBeenCalled();
  expect(mapCamera.flyTo).not.toHaveBeenCalled();
});

it('keeps ordinary search usable when the venue catalog fails', async () => {
  jest.mocked(loadVenues).mockRejectedValue(new Error('venue offline'));
  await refreshVenuePlaceCatalog();
  const { result } = await renderHook(() => useExploreViewModel());
  await act(() => result.current.onQueryChange('公園'));
  await act(async () => jest.advanceTimersByTime(400));
  expect(result.current.resultRows.map((row) => row.title)).toEqual(['戶外公園']);
  expect(result.current.error).toBe(false);
  expect(result.current.loading).toBe(false);
});

it('ignores a late room resolution after the user changes the search', async () => {
  await publishVenue();
  const { result } = await renderHook(() => useExploreViewModel());
  await act(() => result.current.onQueryChange('起點'));
  await act(async () => jest.advanceTimersByTime(400));
  let finish: (detail: ReturnType<typeof createVenueDetail>) => void = () => {};
  jest.mocked(loadVenue).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  await act(() => result.current.resultRows[0].onPress());
  const signal = jest.mocked(loadVenue).mock.calls.at(-1)?.[1];
  await act(() => result.current.onQueryChange('新的查詢'));
  expect(signal?.aborted).toBe(true);
  await act(async () => finish(createVenueDetail()));
  expect(router.navigate).not.toHaveBeenCalled();
  expect(useSavedPlacesStore.getState().searchHistory).toEqual([]);
});

it('resolves a venue deep link with failure and retry without using ordinary place details', async () => {
  jest.mocked(loadVenue).mockRejectedValueOnce(new Error('offline'));
  const id = venuePlaceId({ venueId: 'test-venue', placeId: 'end' });
  const { result } = await renderHook(() => useVenuePlaceDetail(id));
  await act(async () => {});
  expect(result.current.error).toBe(true);
  expect(result.current.entry).toBeNull();
  await act(async () => result.current.retry());
  expect(result.current.entry).toMatchObject({ kind: 'venue-place', placeId: 'end', sourceVersion: 3, levelRef: '2F' });
  expect(getPlaceDetails).not.toHaveBeenCalled();
});

it('keeps newer room data when an earlier catalog refresh finishes later', async () => {
  const detail = createVenueDetail();
  jest.mocked(loadVenues).mockResolvedValue([{ ...detail, buildings: detail.buildings.map(({ id, name }) => ({ id, name })) }]);
  let finish: (value: typeof detail) => void = () => {};
  jest.mocked(loadVenue).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const refreshing = refreshVenuePlaceCatalog();
  await act(async () => {});
  jest.mocked(loadVenue).mockResolvedValue({ ...detail, version: 4 });
  const selected = await resolveVenuePlace({ venueId: detail.venueId, placeId: 'end' });
  expect(selected?.sourceVersion).toBe(4);
  finish(detail);
  await refreshing;
  expect(venuePlaceCatalog.getSnapshot().models[0].version).toBe(4);
});
