import { legacyPlaceDetailToPlaceResult, migrateLegacyPlaceStorage, nominatimToPlaceResult } from '../adapters';
import type { NominatimPlace } from '../../types/place';

// 移植自 Web `src/lib/place/__tests__/adapters.test.ts` + `migrate.test.ts`（commit 5eadc71）。

const nominatimPlace: NominatimPlace = {
  place_id: 42,
  osm_type: 'node',
  osm_id: 123,
  lat: '25.033',
  lon: '121.5654',
  display_name: '臺北市信義區信義路五段7號',
  name: '台北 101',
  class: 'tourism',
  type: 'attraction',
  address: {
    road: '信義路五段',
    suburb: '信義區',
    city: '臺北市',
    postcode: '110',
  },
};

describe('nominatimToPlaceResult', () => {
  it('converts Nominatim ids, review keys, and [lng, lat] coordinates', () => {
    const result = nominatimToPlaceResult(nominatimPlace);

    expect(result.id).toBe('osm:node:123');
    expect(result.reviewKey).toEqual({ placeId: 'node/123', placeType: 'osm' });
    expect(result.location.coordinates).toEqual([121.5654, 25.033]);
    expect(result.addressComponents).toEqual({
      road: '信義路五段',
      district: '信義區',
      city: '臺北市',
      postcode: '110',
    });
  });

  it('uses a coordinate id and no review key without OSM metadata', () => {
    const result = nominatimToPlaceResult({
      ...nominatimPlace,
      osm_type: undefined,
      osm_id: undefined,
    });

    expect(result.id).toBe('coord:25.033,121.5654');
    expect(result.reviewKey).toBeNull();
  });
});

describe('legacyPlaceDetailToPlaceResult / migrateLegacyPlaceStorage', () => {
  it('migrates legacy place entries, passes coordinate entries through, and drops invalid places', () => {
    const legacyPlace = {
      kind: 'place',
      place: nominatimPlace,
      position: { lat: 25.033, lng: 121.5654 },
    };
    const coordinate = {
      kind: 'coordinate',
      address: '地圖點擊位置',
      position: { lat: 25.04, lng: 121.56 },
    };

    expect(legacyPlaceDetailToPlaceResult(legacyPlace)).toMatchObject({
      kind: 'place',
      place: { id: 'osm:node:123' },
      position: legacyPlace.position,
    });
    expect(legacyPlaceDetailToPlaceResult(coordinate)).toBe(coordinate);
    expect(
      legacyPlaceDetailToPlaceResult({
        kind: 'place',
        place: { name: 'incomplete' },
        position: { lat: 25.033, lng: 121.5654 },
      }),
    ).toBeNull();
  });

  it('re-keys saved categories while preserving coordinate favorites', () => {
    const legacyPlace = {
      kind: 'place',
      place: nominatimPlace,
      position: { lat: 25.033, lng: 121.5654 },
    };
    const coordinate = {
      kind: 'coordinate',
      address: '地圖點擊位置',
      position: { lat: 25.04, lng: 121.56 },
    };

    const migrated = migrateLegacyPlaceStorage({
      searchHistory: [],
      savedPlaces: [legacyPlace, coordinate],
      savedPlaceCategories: {
        p_42: 'favorite',
        'c_25.04_121.56': 'food',
      },
    });

    expect(migrated.savedPlaces).toHaveLength(2);
    expect(migrated.savedPlaces[1]).toBe(coordinate);
    expect(migrated.savedPlaceCategories).toEqual({
      'p_osm:node:123': 'favorite',
      'c_25.04_121.56': 'food',
    });
  });
});
