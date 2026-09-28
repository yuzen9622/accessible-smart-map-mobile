import { createMemoryStorage } from '@/shared/storage';

import {
  loadPersistedPlaceState,
  PLACE_SCHEMA_VERSION_KEY,
  SAVED_CATEGORIES_KEY,
  SAVED_PLACES_KEY,
  SEARCH_HISTORY_KEY,
} from '../persistence';

describe('loadPersistedPlaceState', () => {
  it('loads current-format data unchanged when already on version 2', () => {
    const storage = createMemoryStorage({
      [PLACE_SCHEMA_VERSION_KEY]: '2',
      [SEARCH_HISTORY_KEY]: JSON.stringify([{ kind: 'coordinate', address: 'A', position: { lat: 1, lng: 2 } }]),
      [SAVED_PLACES_KEY]: '[]',
      [SAVED_CATEGORIES_KEY]: '{}',
    });

    const state = loadPersistedPlaceState(storage);
    expect(state.searchHistory).toHaveLength(1);
    expect(state.savedPlaces).toEqual([]);
  });

  it('migrates legacy data and bumps the version, re-keying categories', () => {
    const legacyPlace = {
      kind: 'place',
      place: {
        place_id: 42,
        osm_type: 'node',
        osm_id: 123,
        lat: '25.033',
        lon: '121.5654',
        display_name: '台北 101',
      },
      position: { lat: 25.033, lng: 121.5654 },
    };
    const storage = createMemoryStorage({
      [SEARCH_HISTORY_KEY]: '[]',
      [SAVED_PLACES_KEY]: JSON.stringify([legacyPlace]),
      [SAVED_CATEGORIES_KEY]: JSON.stringify({ p_42: 'favorite' }),
    });

    const state = loadPersistedPlaceState(storage);

    expect(state.savedPlaces).toHaveLength(1);
    expect(state.savedPlaceCategories).toEqual({ 'p_osm:node:123': 'favorite' });
    expect(storage.getString(PLACE_SCHEMA_VERSION_KEY)).toBe('2');
    // Re-loading afterwards takes the fast (already-migrated) path.
    const again = loadPersistedPlaceState(storage);
    expect(again.savedPlaceCategories).toEqual({ 'p_osm:node:123': 'favorite' });
  });

  it('defaults to empty state when nothing is stored', () => {
    const storage = createMemoryStorage();
    const state = loadPersistedPlaceState(storage);
    expect(state).toEqual({ searchHistory: [], savedPlaces: [], savedPlaceCategories: {} });
    expect(storage.getString(PLACE_SCHEMA_VERSION_KEY)).toBe('2');
  });
});
