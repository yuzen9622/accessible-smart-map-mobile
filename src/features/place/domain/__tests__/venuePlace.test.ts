import { createVenueDetail } from '@/features/indoor/domain/fixtures/venueFixture';
import { createMemoryStorage } from '@/shared/storage';

import { placeDetailHref } from '../../hooks/placeRoute';
import { loadPersistedPlaceState, PLACE_SCHEMA_VERSION_KEY, SAVED_PLACES_KEY, SEARCH_HISTORY_KEY } from '../../store/persistence';
import { placeKey } from '../placeKey';
import { addToSearchHistory, removeSearchHistoryEntry, sanitizeSearchHistory } from '../searchHistory';
import { parseVenuePlaceId, searchVenuePlaces, toVenuePlaceDetail, venuePlaceId } from '../venuePlace';

it('searches room refs, names, building aliases and floors without merging overlapping places', () => {
  const detail = createVenueDetail();
  detail.buildings[0].aliases = ['資源館'];
  detail.places = detail.places.map((place) => ({ ...place, name: '共同教室', ref: '5111', location: [121, 25] }));
  const results = searchVenuePlaces([detail], '５１１１');
  expect(results).toHaveLength(2);
  expect(results.map(placeKey)).toEqual(['venue:test-venue:start', 'venue:test-venue:end']);
  expect(results.map((place) => place.levelRef)).toEqual(['1F', '2F']);
  expect(searchVenuePlaces([detail], '資源館 2F').map((place) => place.placeId)).toEqual(['end']);
  expect(searchVenuePlaces([detail], '共同教室')).toHaveLength(2);
  expect(searchVenuePlaces([detail], '不存在')).toEqual([]);
});

it('round-trips venue/place identity through the existing place route including reserved characters', () => {
  const detail = createVenueDetail();
  const entry = { ...toVenuePlaceDetail(detail, detail.places[0]), venueId: 'campus/a:b', placeId: 'room:1/2 中文' };
  expect(parseVenuePlaceId(venuePlaceId(entry))).toEqual({ venueId: entry.venueId, placeId: entry.placeId });
  expect(placeDetailHref(entry)).toEqual({ pathname: '/place/[id]', params: { id: venuePlaceId(entry) } });
  expect(parseVenuePlaceId('venue:%zz:x')).toBeNull();
  expect(parseVenuePlaceId('venue::x')).toBeNull();
  expect(parseVenuePlaceId('osm:node:123')).toBeNull();
});

it('persists graph identity and keeps same-named rooms separate from each other and outdoor history', () => {
  const detail = createVenueDetail();
  const start = { ...toVenuePlaceDetail(detail, detail.places[0]), name: '共同教室' };
  const end = { ...toVenuePlaceDetail(detail, detail.places[1]), name: '共同教室' };
  const outdoor = { kind: 'coordinate' as const, address: '共同教室', position: start.position };
  const history = addToSearchHistory(addToSearchHistory([outdoor], start), end);
  expect(history).toHaveLength(3);
  expect(sanitizeSearchHistory(history)).toEqual(history);
  expect(removeSearchHistoryEntry(history, start)).toEqual([end, outdoor]);
  const storage = createMemoryStorage({
    [PLACE_SCHEMA_VERSION_KEY]: '2',
    [SEARCH_HISTORY_KEY]: JSON.stringify([...history, { kind: 'venue-place', venueId: 'bad' }]),
    [SAVED_PLACES_KEY]: JSON.stringify([start, end]),
  });
  expect(loadPersistedPlaceState(storage).searchHistory).toEqual(history);
  expect(loadPersistedPlaceState(storage).savedPlaces).toEqual([start, end]);
  expect(loadPersistedPlaceState(storage).savedPlaces[0]).toMatchObject({ venueId: 'test-venue', placeId: 'start', buildingId: 'a', levelRef: '1F', sourceVersion: 3 });
});
