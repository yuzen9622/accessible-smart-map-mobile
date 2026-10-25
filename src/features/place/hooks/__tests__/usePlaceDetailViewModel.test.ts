import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';

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
      externalLinks: { osm: null, google: 'https://www.google.com/maps/place/?q=place_id:ChIJ-selected-place' },
      attribution: null,
      ...overrides,
    },
  };
}

beforeEach(() => jest.clearAllMocks());

it('opens the CCTV sheet with the place coordinates', async () => {
  const { result } = await renderHook(() => usePlaceDetailViewModel(entry()));
  await act(() => result.current.onOpenCctv());
  expect(router.navigate).toHaveBeenCalledWith({
    pathname: '/cctv/[coords]',
    params: { coords: '25.033,121.5654' },
  });
});
