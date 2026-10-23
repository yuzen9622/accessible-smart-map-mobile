import { a11yPlacesToMarkers } from '../aiResults';
import { getAggregatedToolResults, getToolResultGroup } from '../toolResultCards';
import { t } from '../testing/translate';

const location = { type: 'Point', coordinates: [121.53, 25.03] };

describe('source display names', () => {
  it('uses nonblank facility display names without changing identity or input', () => {
    const facilities = [
      { osmId: 'a', name: '公園', displayName: 'Park', category: 'ramp', location },
      { osmId: 'b', name: '入口', displayName: '  ', category: 'ramp', location },
      { osmId: 'c', displayName: 'English only', category: 'ramp', location },
    ];
    const before = JSON.stringify(facilities);
    const group = getToolResultGroup('getA11yFacilityDetails', { facilities }, t)!;
    expect(group.items.map(({ id, title }) => ({ id, title }))).toEqual([
      { id: 'a11yfac_a', title: 'Park' },
      { id: 'a11yfac_b', title: '入口' },
      { id: 'a11yfac_c', title: 'English only' },
    ]);
    expect(JSON.stringify(facilities)).toBe(before);
  });

  it('does not collapse different IDs sharing a display name', () => {
    const groups = getAggregatedToolResults(['a', 'b', 'a'].map((osmId) => ({
      name: 'getA11yFacilityDetails', status: 'done',
      result: { facilities: [{ osmId, name: '入口', displayName: 'Entrance', category: 'ramp', location }] },
    })), t);
    expect(groups[0].items.map((item) => item.id)).toEqual(['a11yfac_a', 'a11yfac_b']);
  });

  it('uses route-detail display names with direction-scoped stop identity', () => {
    const group = getToolResultGroup('getBusRouteDetail', {
      routeName: '藍一', routeDisplayName: 'Blue 1',
      directions: [{ direction: 0, toDisplayName: 'Station', stops: [
        { stopUid: 'stop-a', name: '車站', displayName: 'Station', lat: 25.03, lng: 121.53 },
      ] }],
    }, t)!;
    expect(group.heading).toContain('Blue 1');
    expect(group.items[0]).toMatchObject({ id: 'stop_0_0_stop-a_0', title: 'Station', subtitle: 'Station' });
  });

  it('uses parking display fields with canonical identity', () => {
    const group = getToolResultGroup('findNearbyParking', { parkingSpots: [
      { id: 'p', placeName: '停車場', displayName: 'Parking', address: '地址', displayAddress: 'Address', location },
    ] }, t)!;
    expect(group.items[0]).toMatchObject({ id: 'parking_p', title: 'Parking', subtitle: 'Address' });
  });

  it('keeps English-only bathroom and OSM markers and falls back on empty display', () => {
    const markers = a11yPlacesToMarkers({ places: {
      nearbyBathroom: [{ _id: 'bath', displayName: 'Restroom', location }],
      nearbyOsm: [
        { osmId: 'osm', name: '斜坡', displayName: 'Ramp', displayAddress: 'Address', location },
        { osmId: 'fallback', name: '入口', displayName: '  ', location },
      ],
    } }, t);
    expect(markers.map(({ id, title }) => ({ id, title }))).toEqual([
      { id: 'bath', title: 'Restroom' }, { id: 'osm', title: 'Ramp' }, { id: 'fallback', title: '入口' },
    ]);
    expect(markers[1].subtitle).toBe('Address');
  });
});
