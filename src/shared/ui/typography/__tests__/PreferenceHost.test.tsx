import { act, render } from '@testing-library/react-native';
import { View } from 'react-native';

import { usePreferencesStore } from '@/shared/preferences/preferencesStore';
import PreferenceHost from '../PreferenceHost.ios';

let mockSystemScale = 1;
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return Object.setPrototypeOf({ useWindowDimensions: () => ({ fontScale: mockSystemScale }) }, actual);
});
jest.mock('@expo/ui/swift-ui', () => ({
  Host: (props: object) => {
    const React = jest.requireActual('react');
    const { View } = jest.requireActual('react-native');
    return React.createElement(View, { ...props, testID: 'native-host' });
  },
}));
jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  dynamicTypeSize: (size: string) => ({ $type: 'dynamicTypeSize', size }),
}));

beforeEach(() => {
  mockSystemScale = 1;
  usePreferencesStore.getState().setPreferences({ fontSize: 'medium' });
});

it('updates the native environment live and removes the override at the default size', async () => {
  const view = await render(<PreferenceHost matchContents style={{ minHeight: 44 }}><View /></PreferenceHost>);
  expect(view.getByTestId('native-host').props.modifiers).toEqual([]);
  await act(() => usePreferencesStore.getState().setPreferences({ fontSize: 'mega' }));
  expect(view.getByTestId('native-host').props.modifiers).toEqual([{ $type: 'dynamicTypeSize', size: 'xxxLarge' }]);
  expect(view.getByTestId('native-host').props.matchContents).toBe(true);
  expect(view.getByTestId('native-host')).toHaveStyle({ minHeight: 44 });
  mockSystemScale = 2.143;
  await view.rerender(<PreferenceHost><View /></PreferenceHost>);
  expect(view.getByTestId('native-host').props.modifiers).toEqual([{ $type: 'dynamicTypeSize', size: 'accessibility4' }]);
  await act(() => usePreferencesStore.getState().setPreferences({ fontSize: 'medium' }));
  expect(view.getByTestId('native-host').props.modifiers).toEqual([]);
});
