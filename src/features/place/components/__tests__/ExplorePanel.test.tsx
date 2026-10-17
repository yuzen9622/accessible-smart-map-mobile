import { act, fireEvent, render } from '@testing-library/react-native';

import { usePreferencesStore } from '@/shared/preferences/preferencesStore';
import type { ExploreViewModel } from '../../hooks/useExploreViewModel';
import ExplorePanel from '../ExplorePanel';

const noop = () => {};
const model: ExploreViewModel = {
  query: '', onQueryChange: noop, onSearchFocus: noop, onSearchBlur: noop, onCancelSearch: noop, loading: false, error: false, onRetry: noop,
  mode: 'idle', historyRows: [], resultRows: [], onOpenNearby: noop, onOpenSaved: noop,
  categoryShortcuts: { sectionTitle: 'Find nearby', nearbyFacilities: [], moreTitle: 'More categories', moreCategories: [] },
  showBrand: false,
  header: { title: 'Where to?', needs: { label: 'Wheelchair', accessibilityLabel: 'Needs', onPress: noop } },
  planRoute: { label: 'Plan route', accessibilityLabel: 'Plan route', onPress: jest.fn() },
  shortcuts: [], shortcutFilters: [], addShortcut: { label: 'Add', accessibilityLabel: 'Add a frequent place', onPress: noop }, nearbySummary: null,
  account: { label: 'Settings', initial: null, onPress: noop },
  voiceInput: { status: 'idle', label: 'Voice conversation', accessibilityLabel: 'Voice conversation', onToggle: noop },
  labels: {
    searchPlaceholder: 'Search', nearbyA11y: 'Nearby', savedPlaces: 'Saved', searchHistory: 'History',
    searchResults: 'Results', noResults: 'No results', searching: 'Searching', cancelSearch: 'Cancel', recentSearches: 'Recent', moreActions: 'More',
    networkError: 'Network error', retry: 'Retry',
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  usePreferencesStore.getState().setPreferences({ fontSize: 'medium' });
});

it('never renders the removed "Where to?" title, with or without the brand row', async () => {
  const view = await render(<ExplorePanel model={model} />);
  for (const showBrand of [true, false, true]) {
    await view.rerender(<ExplorePanel model={{ ...model, showBrand }} />);
    expect(view.queryByText('Where to?')).toBeNull();
  }
});

it('shows the needs pill only when the brand row is visible', async () => {
  const view = await render(<ExplorePanel model={{ ...model, showBrand: false }} />);
  expect(view.queryByText('Wheelchair')).toBeNull();
  await view.rerender(<ExplorePanel model={{ ...model, showBrand: true }} />);
  expect(view.getByText('Wheelchair')).toBeTruthy();
});

it('idle mode shows a plan-route button, nearby summary, and a shortcuts section with its own add button', async () => {
  const home: ExploreViewModel = {
    ...model,
    shortcuts: [{ key: 'home', title: 'Home', meta: null, iconName: 'bookmark', color: '#495057', onPress: noop }],
    nearbySummary: { text: 'Nearby facilities', dots: [], onPress: noop },
  };
  const view = await render(<ExplorePanel model={home} />);
  expect(view.getByRole('button', { name: 'Plan route' })).toBeTruthy();
  expect(view.getByText('Nearby facilities')).toBeTruthy();
  expect(view.getByText('Saved')).toBeTruthy();
  expect(view.getByText('Home')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Plan route' }));
  expect(home.planRoute.onPress).toHaveBeenCalledTimes(1);
  await fireEvent.press(view.getByRole('button', { name: 'Add a frequent place' }));
});

it('history mode (search focused, no query yet) shows deletable recent searches instead of the idle sections', async () => {
  const onDelete = jest.fn();
  const historyModel: ExploreViewModel = {
    ...model,
    mode: 'history',
    showBrand: true,
    historyRows: [{ key: 'recent', title: 'Recent place', resolving: false, disabled: false, onPress: noop, onDelete, deleteA11yLabel: 'Delete Recent place' }],
  };
  const view = await render(<ExplorePanel model={historyModel} />);
  expect(view.getByText('Recent place')).toBeTruthy();
  expect(view.queryByRole('button', { name: 'Plan route' })).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Delete Recent place' }));
  expect(onDelete).toHaveBeenCalledTimes(1);
});

it('updates the rendered home text and search input immediately for every font preference', async () => {
  const home: ExploreViewModel = {
    ...model,
    showBrand: true,
    shortcuts: [{ key: 'home', title: 'Home', meta: null, iconName: 'bookmark', color: '#495057', onPress: noop }],
  };
  const view = await render(<ExplorePanel model={home} />);
  for (const [level, scale] of [['small', 0.875], ['medium', 1], ['large', 1.25], ['mega', 1.375]] as const) {
    await act(() => usePreferencesStore.getState().setPreferences({ fontSize: level }));
    expect(view.getByPlaceholderText('Search')).toHaveStyle({ fontSize: 16 * scale });
    expect(view.getByText('Home')).toHaveStyle({ fontSize: 13 * scale });
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
