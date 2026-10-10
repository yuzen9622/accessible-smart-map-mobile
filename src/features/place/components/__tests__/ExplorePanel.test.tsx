import { act, fireEvent, render } from '@testing-library/react-native';

import { usePreferencesStore } from '@/shared/preferences/preferencesStore';
import type { ExploreViewModel } from '../../hooks/useExploreViewModel';
import ExplorePanel from '../ExplorePanel';

const noop = () => {};
const model: ExploreViewModel = {
  query: '', onQueryChange: noop, onSearchFocus: noop, loading: false, error: false, onRetry: noop,
  mode: 'history', historyRows: [], resultRows: [], onOpenNearby: noop, onOpenSaved: noop,
  showBrand: false,
  header: { title: 'Where to?', needs: { label: 'Wheelchair', accessibilityLabel: 'Needs', onPress: noop } },
  shortcuts: [], addShortcut: { label: 'Add', onPress: noop }, nearbySummary: null,
  quickActions: [
    { key: 'assistant', label: 'Assistant', iconName: 'sparkles', onPress: jest.fn() },
    { key: 'plan', label: 'Plan route', iconName: 'navigation', onPress: jest.fn() },
    { key: 'bus', label: 'Bus', iconName: 'bus', onPress: noop },
  ],
  account: { label: 'Settings', initial: null, onPress: noop },
  labels: {
    searchPlaceholder: 'Search', nearbyA11y: 'Nearby', savedPlaces: 'Saved', searchHistory: 'History',
    searchResults: 'Results', noResults: 'No results', recentSearches: 'Recent', moreActions: 'More',
    networkError: 'Network error', retry: 'Retry',
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  usePreferencesStore.getState().setPreferences({ fontSize: 'medium' });
});

it('keeps the original home sections when the sheet collapses or its title is hidden', async () => {
  const home: ExploreViewModel = {
    ...model,
    shortcuts: [{ key: 'home', title: 'Home', meta: null, iconName: 'bookmark', onPress: noop }],
    nearbySummary: { text: 'Nearby facilities', dots: [], onPress: noop },
    historyRows: [{ key: 'recent', title: 'Recent place', resolving: false, disabled: false, onPress: noop }],
  };
  const view = await render(<ExplorePanel model={home} />);
  expect(view.queryByText('Where to?')).toBeNull();
  expect(view.getByText('Add')).toBeTruthy();
  expect(view.getByText('More')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Bus' })).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Assistant' }));
  await fireEvent.press(view.getByRole('button', { name: 'Plan route' }));
  expect(model.quickActions[0].onPress).toHaveBeenCalledTimes(1);
  expect(model.quickActions[1].onPress).toHaveBeenCalledTimes(1);
  for (const showBrand of [true, false, true]) {
    await view.rerender(<ExplorePanel model={{ ...home, showBrand }} />);
    expect(view.getByText('Home')).toBeTruthy();
    expect(view.getByText('Nearby facilities')).toBeTruthy();
    expect(view.getByText('Recent place')).toBeTruthy();
    expect(view.getAllByRole('button', { name: 'Assistant' })).toHaveLength(1);
    expect(view.getAllByRole('button', { name: 'Plan route' })).toHaveLength(1);
  }
});

it('updates the rendered home text and search input immediately for every font preference', async () => {
  const view = await render(<ExplorePanel model={{ ...model, showBrand: true }} />);
  for (const [level, scale] of [['small', 0.875], ['medium', 1], ['large', 1.25], ['mega', 1.375]] as const) {
    await act(() => usePreferencesStore.getState().setPreferences({ fontSize: level }));
    expect(view.getByPlaceholderText('Search')).toHaveStyle({ fontSize: 16 * scale });
    expect(view.getByText('Where to?')).toHaveStyle({ fontSize: 28 * scale });
    expect(view.getByText('Assistant')).toHaveStyle({ fontSize: 15 * scale });
    if (level === 'mega') {
      expect(view.getByText('Where to?').props.numberOfLines).toBeUndefined();
      expect(view.getByText('Wheelchair').props.numberOfLines).toBeUndefined();
    }
  }
});

it('keeps search results through collapse and re-expansion', async () => {
  const resultModel: ExploreViewModel = {
    ...model, showBrand: true, mode: 'results', query: 'Station',
    resultRows: [{ key: 'station', title: 'Station', resolving: false, disabled: false, onPress: noop }],
  };
  const view = await render(<ExplorePanel model={resultModel} />);
  for (const showBrand of [false, true, false]) {
    await view.rerender(<ExplorePanel model={{ ...resultModel, showBrand }} />);
    expect(view.getByRole('button', { name: 'Station' })).toBeTruthy();
    expect(view.getByText('Results')).toBeTruthy();
  }
});
