import { act, fireEvent, render } from '@testing-library/react-native';

import { usePreferencesStore } from '@/shared/preferences/preferencesStore';
import type { ExploreViewModel } from '../../hooks/useExploreViewModel';
import ExplorePanel from '../ExplorePanel';

const noop = () => {};
const model: ExploreViewModel = {
  query: '', onQueryChange: noop, onSearchFocus: noop, onSearchBlur: noop, onCancelSearch: noop, loading: false, error: false, onRetry: noop,
  mode: 'idle', historyRows: [], resultRows: [], onOpenNearby: noop, onOpenSaved: noop,
  categoryShortcuts: { sectionTitle: 'Find nearby', nearbyFacilities: [], moreTitle: 'More categories', moreCategories: [] },
  facilityToggles: [],
  needsPill: { label: 'General', accessibilityLabel: 'Accessibility needs: General', onPress: noop },
  planRoute: { label: 'Plan route', onPress: noop },
  shortcuts: [], shortcutFilters: [], addShortcut: { label: 'Add', accessibilityLabel: 'Add a frequent place', onPress: noop }, nearbySummary: null,
  quickActions: [
    { key: 'assistant', label: 'Assistant', iconName: 'sparkles', color: '#7048E8', onPress: jest.fn() },
    { key: 'bus', label: 'Bus', iconName: 'bus', color: '#0F9960', onPress: noop },
  ],
  account: { label: 'Settings', initial: null, avatarUrl: null, onPress: noop },
  voiceInput: { status: 'idle', accessibilityLabel: 'Voice conversation', onToggle: noop },
  labels: {
    searchPlaceholder: 'Search', nearbyA11y: 'Nearby', savedPlaces: 'Saved', searchHistory: 'History',
    searchResults: 'Results', noResults: 'No results', searching: 'Searching', cancelSearch: 'Cancel', recentSearches: 'Recent', moreActions: 'More',
    quickServices: 'Quick services', networkError: 'Network error', retry: 'Retry',
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  usePreferencesStore.getState().setPreferences({ fontSize: 'medium' });
});

it('never renders the removed "Where to?" title', async () => {
  const view = await render(<ExplorePanel model={model} />);
  expect(view.queryByText('Where to?')).toBeNull();
});

it('idle mode shows quick services, a plan-route button, nearby summary, and a shortcuts section with its own add button', async () => {
  const home: ExploreViewModel = {
    ...model,
    shortcuts: [{ key: 'home', title: 'Home', meta: null, iconName: 'bookmark', color: '#495057', onPress: noop, onLongPress: noop }],
    nearbySummary: { text: 'Nearby facilities', dots: [], onPress: noop },
  };
  const view = await render(<ExplorePanel model={home} />);
  expect(view.getByText('Quick services')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Assistant' })).toBeTruthy();
  expect(view.getByRole('button', { name: 'Bus' })).toBeTruthy();
  expect(view.getByRole('button', { name: 'Plan route' })).toBeTruthy();
  expect(view.getByText('Nearby facilities')).toBeTruthy();
  expect(view.getByText('Saved')).toBeTruthy();
  expect(view.getByText('Home')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Assistant' }));
  expect(home.quickActions[0].onPress).toHaveBeenCalledTimes(1);
  await fireEvent.press(view.getByRole('button', { name: 'Add a frequent place' }));
});

it('history mode (search focused, no query yet) shows deletable recent searches instead of the idle sections', async () => {
  const onDelete = jest.fn();
  const historyModel: ExploreViewModel = {
    ...model,
    mode: 'history',
    historyRows: [{ key: 'recent', title: 'Recent place', resolving: false, disabled: false, onPress: noop, onDelete, deleteA11yLabel: 'Delete Recent place' }],
  };
  const view = await render(<ExplorePanel model={historyModel} />);
  expect(view.getByText('Recent place')).toBeTruthy();
  expect(view.queryByText('Quick services')).toBeNull();
  expect(view.queryByRole('button', { name: 'Assistant' })).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Delete Recent place' }));
  expect(onDelete).toHaveBeenCalledTimes(1);
});

it('updates the rendered home text and search input immediately for every font preference', async () => {
  const view = await render(<ExplorePanel model={model} />);
  for (const [level, scale] of [['small', 0.875], ['medium', 1], ['large', 1.25], ['mega', 1.375]] as const) {
    await act(() => usePreferencesStore.getState().setPreferences({ fontSize: level }));
    expect(view.getByPlaceholderText('Search')).toHaveStyle({ fontSize: 16 * scale });
    expect(view.getByText('Assistant')).toHaveStyle({ fontSize: 13 * scale });
  }
});

it('keeps search results through collapse and re-expansion', async () => {
  const resultModel: ExploreViewModel = {
    ...model, mode: 'results', query: 'Station',
    resultRows: [{ key: 'station', title: 'Station', resolving: false, disabled: false, onPress: noop }],
  };
  const view = await render(<ExplorePanel model={resultModel} />);
  for (let i = 0; i < 3; i++) {
    await view.rerender(<ExplorePanel model={{ ...resultModel }} />);
    expect(view.getByRole('button', { name: 'Station' })).toBeTruthy();
    expect(view.getByText('Results')).toBeTruthy();
  }
});

it('prevents repeated voice-search taps while starting without adding status text', async () => {
  const onToggle = jest.fn();
  const view = await render(<ExplorePanel model={{
    ...model,
    voiceInput: { status: 'starting', accessibilityLabel: 'Starting voice input…', onToggle },
  }} />);

  expect(view.queryByText('Starting voice input…')).toBeNull();
  const button = view.getByRole('button', { name: 'Starting voice input…' });
  expect(button).toBeDisabled();
  await fireEvent.press(button);
  expect(onToggle).not.toHaveBeenCalled();
});

it('keeps voice-search feedback on the microphone button without extra text', async () => {
  const view = await render(<ExplorePanel model={{
    ...model,
    voiceInput: { ...model.voiceInput, status: 'listening', accessibilityLabel: 'Listening… tap again to stop' },
  }} />);
  expect(view.queryByText('Listening… tap again to stop')).toBeNull();
  expect(view.getByRole('button', { name: 'Listening… tap again to stop', selected: true })).toBeTruthy();
  expect(view.getByTestId('icon-mic', { includeHiddenElements: true })).toBeTruthy();

  await view.rerender(<ExplorePanel model={{
    ...model,
    voiceInput: { ...model.voiceInput, status: 'error' },
  }} />);
  expect(view.queryByRole('alert')).toBeNull();
  expect(view.getByRole('button', { name: 'Voice conversation', selected: false })).toBeTruthy();
});
