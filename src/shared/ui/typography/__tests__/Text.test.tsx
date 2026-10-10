import { act, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { usePreferencesStore } from '@/shared/preferences/preferencesStore';
import { Text, TextInput } from '../Text';

beforeEach(() => usePreferencesStore.getState().setPreferences({ fontSize: 'medium' }));

it('reactively scales typography without changing layout or disabling system scaling', async () => {
  const view = await render(<Text testID="text" style={{ fontSize: 20, lineHeight: 28, padding: 8 }} maxFontSizeMultiplier={2}>Example</Text>);
  await act(() => usePreferencesStore.getState().setPreferences({ fontSize: 'mega' }));
  const text = view.getByTestId('text');
  expect(text).toHaveStyle({ fontSize: 27.5, lineHeight: 38.5, padding: 8 });
  expect(text.props.allowFontScaling).not.toBe(false);
  expect(text.props.maxFontSizeMultiplier).toBe(2);
});

it('nested text inherits the scaled parent without scaling twice', async () => {
  const view = await render(<Text style={{ fontSize: 20 }}><Text testID="inherited" style={{ fontWeight: 'bold' }}>Inherited</Text><Text testID="explicit" style={{ fontSize: 12 }}>Small</Text></Text>);
  await act(() => usePreferencesStore.getState().setPreferences({ fontSize: 'mega' }));
  expect(StyleSheet.flatten(view.getByTestId('inherited').props.style).fontSize).toBeUndefined();
  expect(view.getByTestId('explicit')).toHaveStyle({ fontSize: 16.5 });
});

it('inputs retain behavior and rescale when the preference changes back', async () => {
  const view = await render(<TextInput testID="input" value="abc" multiline style={{ fontSize: 16, lineHeight: 22 }} />);
  await act(() => usePreferencesStore.getState().setPreferences({ fontSize: 'mega' }));
  expect(view.getByTestId('input')).toHaveStyle({ fontSize: 22, lineHeight: 30.25 });
  await act(() => usePreferencesStore.getState().setPreferences({ fontSize: 'medium' }));
  expect(view.getByTestId('input')).toHaveStyle({ fontSize: 16, lineHeight: 22 });
  expect(view.getByTestId('input').props.value).toBe('abc');
  expect(view.getByTestId('input').props.multiline).toBe(true);
});
