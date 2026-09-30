import { nearbyFacilityRows } from '../nearbyFacilityRows';
import type { NearbyFacilityBrief, PlaceResult } from '../../types/place';

const format = (meters: number) => `${meters} m`;

function brief(id: string, category: string, distanceMeters: number): NearbyFacilityBrief {
  return { id, name: `n-${id}`, address: null, category, typeLabel: `type-${category}`, distanceMeters };
}

function place(nearbyFacilities: PlaceResult['nearbyFacilities']): PlaceResult {
  return {
    id: 'osm:node:1',
    source: 'osm',
    name: 'X',
    fullAddress: null,
    addressComponents: { road: null, district: null, city: null, postcode: null },
    location: { type: 'Point', coordinates: [121, 25] },
    placeClass: null,
    placeType: null,
    typeLabel: null,
    distanceMeters: null,
    rating: null,
    accessibility: { status: 'unknown', wheelchair: null, nearbyFacilityCount: 0, source: 'none' },
    nearbyFacilities,
    reviewKey: null,
    externalLinks: { osm: null, google: null },
    attribution: null,
  };
}

describe('nearbyFacilityRows', () => {
  it('returns [] for null place', () => {
    expect(nearbyFacilityRows(null, format)).toEqual([]);
  });

  it('returns [] when nearbyFacilities is undefined', () => {
    const broken = { ...place({ toilets: [], metro: [] }), nearbyFacilities: undefined } as unknown as PlaceResult;
    expect(nearbyFacilityRows(broken, format)).toEqual([]);
  });

  it('tolerates a missing inner array', () => {
    const partial = { ...place({ toilets: [], metro: [] }), nearbyFacilities: { toilets: [brief('a', 'toilet', 5)] } } as unknown as PlaceResult;
    expect(nearbyFacilityRows(partial, format).map((r) => r.name)).toEqual(['n-a']);
  });

  it('ignores malformed nearby payloads rather than crashing Detail', () => {
    const malformed = {
      ...place({ toilets: [], metro: [] }),
      nearbyFacilities: { toilets: 'not an array', metro: [null, {}, brief('ok', 'metro', 42), { ...brief('bad', 'toilet', 5), distanceMeters: NaN }] },
    } as unknown as PlaceResult;
    expect(nearbyFacilityRows(malformed, format).map((row) => row.key)).toEqual(['metro-ok']);
  });

  it('merges toilets and metro sorted by ascending distance', () => {
    const rows = nearbyFacilityRows(
      place({ toilets: [brief('t1', 'toilet', 300), brief('t2', 'toilet', 50)], metro: [brief('m1', 'metro', 120)] }),
      format,
    );
    expect(rows.map((r) => r.name)).toEqual(['n-t2', 'n-m1', 'n-t1']);
    expect(rows[0]).toEqual({ key: 'toilet-t2', name: 'n-t2', address: null, typeLabel: 'type-toilet', distanceText: '50 m', kind: 'toilet' });
    expect(rows[1]?.kind).toBe('metro');
  });

  it('keeps only the nearest 5', () => {
    const toilets = [1, 2, 3, 4].map((i) => brief(`t${i}`, 'toilet', i * 100));
    const metro = [1, 2, 3].map((i) => brief(`m${i}`, 'metro', i * 100 + 50));
    const rows = nearbyFacilityRows(place({ toilets, metro }), format);
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.name)).toEqual(['n-t1', 'n-m1', 'n-t2', 'n-m2', 'n-t3']);
  });
});
