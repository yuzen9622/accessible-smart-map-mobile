import { buildAccessibilityChecklist } from '../accessibilityChecklist';
import type { PlaceResult } from '../../types/place';

function place(wheelchair: PlaceResult['accessibility']['wheelchair']): PlaceResult {
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
    accessibility: { status: 'unknown', wheelchair, nearbyFacilityCount: 0, source: 'none' },
    nearbyFacilities: { toilets: [], metro: [] },
    reviewKey: null,
    externalLinks: { osm: null, google: null },
    attribution: null,
  };
}

describe('buildAccessibilityChecklist', () => {
  it('maps wheelchair yes/limited to true, no to false, and anything else to null', () => {
    expect(buildAccessibilityChecklist(place('yes')).find((i) => i.key === 'wheelchair')?.available).toBe(true);
    expect(buildAccessibilityChecklist(place('limited')).find((i) => i.key === 'wheelchair')?.available).toBe(true);
    expect(buildAccessibilityChecklist(place('no')).find((i) => i.key === 'wheelchair')?.available).toBe(false);
    expect(buildAccessibilityChecklist(place(null)).find((i) => i.key === 'wheelchair')?.available).toBeNull();
  });

  it('never marks elevator/ramp/toilet as false (tri-state invariant)', () => {
    for (const wheelchair of ['yes', 'limited', 'no', null] as const) {
      const items = buildAccessibilityChecklist(place(wheelchair));
      for (const key of ['elevator', 'ramp', 'toilet'] as const) {
        const item = items.find((i) => i.key === key);
        expect(item?.available).not.toBe(false);
      }
    }
  });
});
