import { act, renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';

import type { PlaceDetail, PlaceResult } from '../../types/place';
import { usePlaceDetailViewModel } from '../usePlaceDetailViewModel';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('@/features/map', () => ({
  mapCamera: { flyTo: jest.fn() },
  useUserLocationStore: () => null,
  formatDistance: jest.fn(),
}));
jest.mock('@/shared/config', () => ({ getAppConfig: () => ({ shareBaseUrl: 'https://map.example.com' }) }));
jest.mock('@/shared/i18n', () => ({
  useAppTranslation: () => ({ t: (key: string) => key, i18n: { language: 'zh-TW' } }),
}));
jest.mock('../useReviews', () => ({
  useReviews: () => ({ reviews: [], summary: null, totalCount: 0, loading: false, hasMore: false, loadMore: jest.fn() }),
}));

function entry(overrides: Partial<PlaceResult> = {}): PlaceDetail {
  return {
    kind: 'place',
    position: { lat: 25.033, lng: 121.5654 },
    place: {
      id: 'google:ChIJ-selected-place',
      source: 'google',
      name: '台北 101 & 商場',
      fullAddress: '臺北市信義區信義路五段7號',
      addressComponents: { road: null, district: null, city: null, postcode: null },
      location: { type: 'Point', coordinates: [121.5654, 25.033] },
      placeClass: null,
      placeType: null,
      typeLabel: null,
      distanceMeters: null,
      rating: null,
      accessibility: { status: 'unknown', wheelchair: null, nearbyFacilityCount: 0, source: 'none' },
      nearbyFacilities: { toilets: [], metro: [] },
      reviewKey: { placeId: 'ChIJ-selected-place', placeType: 'google' },
      // Match the legacy URL currently produced by the backend.
      externalLinks: { osm: null, google: 'https://www.google.com/maps/place/?q=place_id:ChIJ-selected-place' },
      attribution: null,
      ...overrides,
    },
  };
}

const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
beforeEach(() => jest.clearAllMocks());

it('opens the selected Google Place ID using the cross-platform Maps URL contract', async () => {
  const { result } = await renderHook(() => usePlaceDetailViewModel(entry()));
  await act(() => result.current.links.find((link) => link.label === 'viewOnGoogleMaps')!.onPress());

  const url = new URL(openURL.mock.calls[0][0]);
  expect(url.origin + url.pathname).toBe('https://www.google.com/maps/search/');
  expect(url.searchParams.get('api')).toBe('1');
  expect(url.searchParams.get('query_place_id')).toBe('ChIJ-selected-place');
  expect(url.searchParams.get('query')).toBe('台北 101 & 商場 臺北市信義區信義路五段7號');
});

it('uses the newly selected identity even when an external link points to another place', async () => {
  const { result, rerender } = await renderHook(({ place }: { place: PlaceDetail }) => usePlaceDetailViewModel(place), {
    initialProps: { place: entry() },
  });
  await rerender({ place: entry({ id: 'google:ChIJ-second-place', name: '另一個地點' }) });
  await act(() => result.current.links.find((link) => link.label === 'viewOnGoogleMaps')!.onPress());
  expect(new URL(openURL.mock.calls[0][0]).searchParams.get('query_place_id')).toBe('ChIJ-second-place');
});

it('can open a Google place without a backend external link or review key', async () => {
  const { result } = await renderHook(() => usePlaceDetailViewModel(entry({
    externalLinks: { osm: null, google: null }, reviewKey: null,
  })));
  const link = result.current.links.find((item) => item.label === 'viewOnGoogleMaps');
  expect(link).toBeDefined();
  await act(() => link!.onPress());
  expect(new URL(openURL.mock.calls[0][0]).searchParams.get('query_place_id')).toBe('ChIJ-selected-place');
});

it('uses latitude,longitude as the required query when no name or address is available', async () => {
  const { result } = await renderHook(() => usePlaceDetailViewModel(entry({ name: '', fullAddress: null })));
  await act(() => result.current.links.find((link) => link.label === 'viewOnGoogleMaps')!.onPress());
  const url = new URL(openURL.mock.calls[0][0]);
  expect(url.searchParams.get('query')).toBe('25.033,121.5654');
  expect(url.searchParams.get('query_place_id')).toBe('ChIJ-selected-place');
});

it('preserves OSM links without treating an OSM identifier as a Google Place ID', async () => {
  const osm = 'https://www.openstreetmap.org/node/123';
  const { result } = await renderHook(() => usePlaceDetailViewModel(entry({
    id: 'osm:node:123', source: 'osm', reviewKey: null, externalLinks: { osm, google: null },
  })));
  expect(result.current.links.map((link) => link.label)).toEqual(['viewOnOSM']);
  await act(() => result.current.links[0].onPress());
  expect(openURL).toHaveBeenCalledWith(osm);
});

it('keeps coordinate-only entries free of fabricated Google place links', async () => {
  const { result } = await renderHook(() => usePlaceDetailViewModel({
    kind: 'coordinate', address: '地圖選定位置', position: { lat: 25.033, lng: 121.5654 },
  }));
  expect(result.current.links).toEqual([]);
});
