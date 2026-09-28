import { placeKey, SAVED_PLACE_CATEGORIES } from '../placeKey';
import type { PlaceDetail } from '../../types/place';

// 移植自 Web `src/stores/__tests__/placeKey.test.ts`（commit 5eadc71）。

describe('placeKey', () => {
  it('uses the prefixed backend id instead of the legacy Nominatim place_id', () => {
    const place: PlaceDetail = {
      kind: 'place',
      place: {
        id: 'osm:node:123',
        source: 'osm',
        name: '台北 101',
        fullAddress: '臺北市信義區信義路五段7號',
        addressComponents: {
          road: '信義路五段',
          district: '信義區',
          city: '臺北市',
          postcode: '110',
        },
        location: { type: 'Point', coordinates: [121.5654, 25.033] },
        placeClass: 'tourism',
        placeType: 'attraction',
        typeLabel: '景點',
        distanceMeters: null,
        rating: null,
        accessibility: {
          status: 'unknown',
          wheelchair: null,
          nearbyFacilityCount: 0,
          source: 'none',
        },
        nearbyFacilities: { toilets: [], metro: [] },
        reviewKey: { placeId: 'node/123', placeType: 'osm' },
        externalLinks: { osm: null, google: null },
        attribution: '© OpenStreetMap contributors',
      },
      position: { lat: 25.033, lng: 121.5654 },
    };

    const key = placeKey(place);

    expect(key).toBe('p_osm:node:123');
    expect(key).not.toBe('p_123');
  });

  it('uses c_{lat}_{lng} for coordinate-kind entries', () => {
    const coordinate: PlaceDetail = { kind: 'coordinate', address: '地圖點擊位置', position: { lat: 25.04, lng: 121.56 } };
    expect(placeKey(coordinate)).toBe('c_25.04_121.56');
  });
});

describe('SAVED_PLACE_CATEGORIES', () => {
  it('matches the Web set', () => {
    expect(SAVED_PLACE_CATEGORIES).toEqual(['favorite', 'food', 'transport', 'medical', 'other']);
  });
});
