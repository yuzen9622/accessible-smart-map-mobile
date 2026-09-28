import { buildPlaceBadges } from '../placeBadges';
import type { PlaceResult } from '../../types/place';

const t = (key: string) => `t:${key}`;

function place(overrides: Partial<PlaceResult> = {}): PlaceResult {
  return {
    id: 'google:abc',
    source: 'google',
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
    nearbyFacilities: { toilets: [], metro: [] },
    reviewKey: null,
    externalLinks: { osm: null, google: null },
    attribution: null,
    ...overrides,
  };
}

function withStatus(status: PlaceResult['accessibility']['status']): PlaceResult {
  return place({ accessibility: { status, wheelchair: null, nearbyFacilityCount: 0, source: 'none' } });
}

describe('buildPlaceBadges', () => {
  it('returns [] for null place', () => {
    expect(buildPlaceBadges(null, t)).toEqual([]);
  });

  it('omits the type badge when typeLabel is null or empty', () => {
    expect(buildPlaceBadges(place({ typeLabel: null }), t).map((b) => b.key)).toEqual(['a11y']);
    expect(buildPlaceBadges(place({ typeLabel: '' }), t).map((b) => b.key)).toEqual(['a11y']);
  });

  it('puts the type badge first as neutral without icon', () => {
    const badges = buildPlaceBadges(place({ typeLabel: '餐廳' }), t);
    expect(badges[0]).toEqual({ key: 'type', label: '餐廳', tone: 'neutral', iconName: null });
    expect(badges[1]?.key).toBe('a11y');
  });

  it('maps each accessibility status to its label key and tone', () => {
    expect(buildPlaceBadges(withStatus('accessible'), t)).toEqual([
      { key: 'a11y', label: 't:a11yBadgeAccessible', tone: 'ok', iconName: 'accessibility' },
    ]);
    expect(buildPlaceBadges(withStatus('limited'), t)).toEqual([
      { key: 'a11y', label: 't:a11yBadgeLimited', tone: 'warn', iconName: 'accessibility' },
    ]);
    expect(buildPlaceBadges(withStatus('unknown'), t)).toEqual([
      { key: 'a11y', label: 't:a11yBadgeUnknown', tone: 'warn', iconName: 'accessibility' },
    ]);
  });

  it('falls back to the unknown badge when accessibility is missing', () => {
    const broken = { ...place(), accessibility: undefined } as unknown as PlaceResult;
    expect(() => buildPlaceBadges(broken, t)).not.toThrow();
    expect(buildPlaceBadges(broken, t)).toEqual([
      { key: 'a11y', label: 't:a11yBadgeUnknown', tone: 'warn', iconName: 'accessibility' },
    ]);
  });
});
