import {
  addSavedPlaceEntry,
  addToSearchHistory,
  removeSavedPlaceEntry,
  removeSearchHistoryEntry,
  sanitizeSavedPlaces,
  sanitizeSearchHistory,
  SEARCH_HISTORY_MAX,
} from '../searchHistory';
import type { PlaceDetail } from '../../types/place';

// 移植自 Web `src/stores/map/createSearchSlice.ts` 的搜尋歷史／收藏規則（commit 5eadc71）。

function coord(address: string, lat = 25, lng = 121): PlaceDetail {
  return { kind: 'coordinate', address, position: { lat, lng } };
}

describe('addToSearchHistory', () => {
  it('prepends and dedupes by display name', () => {
    const history = [coord('B'), coord('A')];
    const next = addToSearchHistory(history, coord('A', 1, 1));
    expect(next.map((e) => (e.kind === 'coordinate' ? e.address : ''))).toEqual(['A', 'B']);
    expect(next).toHaveLength(2);
  });

  it('caps length at 10', () => {
    const history = Array.from({ length: 12 }, (_, i) => coord(`item-${i}`));
    const next = addToSearchHistory(history, coord('new'));
    expect(next).toHaveLength(SEARCH_HISTORY_MAX);
    expect(next[0]).toEqual(coord('new'));
  });

  it('is a no-op for entries with no display name', () => {
    const history = [coord('A')];
    const next = addToSearchHistory(history, coord('   '));
    expect(next).toEqual(history);
  });
});

describe('removeSearchHistoryEntry', () => {
  it('removes the entry matching by display name', () => {
    const a = coord('A');
    const b = coord('B', 2, 2);
    expect(removeSearchHistoryEntry([a, b], a)).toEqual([b]);
  });

  it('is a no-op when the name is not present', () => {
    const history = [coord('A')];
    expect(removeSearchHistoryEntry(history, coord('Z'))).toEqual(history);
  });
});

describe('sanitizeSearchHistory', () => {
  it('drops blank-name entries and dedupes by name, keeping first occurrence', () => {
    const result = sanitizeSearchHistory([coord('A'), coord(''), coord('A', 9, 9), coord('B')]);
    expect(result.map((e) => (e.kind === 'coordinate' ? e.address : ''))).toEqual(['A', 'B']);
  });
});

describe('saved places', () => {
  it('addSavedPlaceEntry is idempotent by key and no-ops on blank name', () => {
    const first = addSavedPlaceEntry([], coord('A'));
    expect(first.added).toBe(true);
    expect(first.places).toHaveLength(1);

    const dup = addSavedPlaceEntry(first.places, coord('A'));
    expect(dup.added).toBe(false);
    expect(dup.places).toHaveLength(1);

    const blank = addSavedPlaceEntry(first.places, coord(' '));
    expect(blank.added).toBe(false);
    expect(blank.places).toHaveLength(1);
  });

  it('removeSavedPlaceEntry removes by key', () => {
    const a = coord('A');
    const b = coord('B', 2, 2);
    const result = removeSavedPlaceEntry([a, b], a);
    expect(result.removed).toBe(true);
    expect(result.places).toEqual([b]);
  });

  it('sanitizeSavedPlaces drops blank names but keeps duplicates', () => {
    const result = sanitizeSavedPlaces([coord('A'), coord(''), coord('A', 9, 9)]);
    expect(result).toHaveLength(2);
  });
});
