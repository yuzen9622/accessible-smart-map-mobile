import { buildPlaceShareUrl } from '../shareUrl';
import type { PlaceDetail, PlaceResult } from '../../types/place';

// 移植自 Web `PlaceContent.tsx:207-227` handleShare 的 URL 組法（commit 5eadc71）。

const basePlace: PlaceResult = {
  id: 'osm:node:123',
  source: 'osm',
  name: 'A',
  fullAddress: null,
  addressComponents: { road: null, district: null, city: null, postcode: null },
  location: { type: 'Point', coordinates: [121.5, 25.0] },
  placeClass: null,
  placeType: null,
  typeLabel: null,
  distanceMeters: null,
  rating: null,
  accessibility: { status: 'unknown', wheelchair: null, nearbyFacilityCount: 0, source: 'none' },
  nearbyFacilities: { toilets: [], metro: [] },
  reviewKey: null,
  externalLinks: { osm: null, google: null },
  attribution: null,
};

describe('buildPlaceShareUrl', () => {
  it('uses ?place= for osm:/google: prefixed place ids', () => {
    const entry: PlaceDetail = { kind: 'place', place: basePlace, position: { lat: 25, lng: 121.5 } };
    expect(buildPlaceShareUrl('https://map.yuzen.dev', entry)).toBe('https://map.yuzen.dev?place=osm%3Anode%3A123');
  });

  it('uses ?loc= for coord: ids and coordinate-kind entries', () => {
    const coordPlace: PlaceDetail = {
      kind: 'place',
      place: { ...basePlace, id: 'coord:25,121.5' },
      position: { lat: 25, lng: 121.5 },
    };
    expect(buildPlaceShareUrl('https://map.yuzen.dev/', coordPlace)).toBe('https://map.yuzen.dev?loc=25,121.5');

    const coordinate: PlaceDetail = { kind: 'coordinate', address: 'x', position: { lat: 25.04, lng: 121.56 } };
    expect(buildPlaceShareUrl('https://map.yuzen.dev', coordinate)).toBe('https://map.yuzen.dev?loc=25.04,121.56');
  });
});
