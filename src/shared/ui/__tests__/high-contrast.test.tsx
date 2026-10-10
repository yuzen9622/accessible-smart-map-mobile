import { act, fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';

import SettingsPanel from '@/features/settings/components/SettingsPanel.ios';
import type { SettingsPanelProps } from '@/features/settings/components/SettingsPanel.types';
import { usePreferencesStore } from '@/shared/preferences/preferencesStore';
import { Colors } from '@/shared/theme/colors';
import { semanticColors } from '@/shared/theme/tokens';
import GlassCard from '../GlassCard.ios';

let mockScheme: 'light' | 'dark' = 'light';

jest.mock('@/shared/i18n', () => ({ useAppTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return Object.setPrototypeOf({ useColorScheme: () => mockScheme }, actual);
});
// Only replace the native rendering boundary; the settings panel, store and theme hooks are real.
jest.mock('@expo/ui/swift-ui', () => {
  const React = jest.requireActual('react');
  const { View, Text: RNText } = jest.requireActual('react-native');
  return Object.fromEntries(['Host', 'Form', 'Section', 'Text', 'Toggle', 'Picker', 'Button', 'LabeledContent', 'VStack'].map(name => [name,
    ({ children, ...props }: { children?: React.ReactNode }) => React.createElement(name === 'Text' ? RNText : View, { ...props, testID: name }, children),
  ]));
});
jest.mock('expo-glass-effect', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { isLiquidGlassAvailable: () => true, GlassView: (props: object) => React.createElement(View, { ...props, testID: 'glass' }) };
});

function Settings() {
  const highContrast = usePreferencesStore(s => s.highContrast);
  const model = {
    highContrast, setHighContrast: (value: boolean) => usePreferencesStore.getState().setPreferences({ highContrast: value }),
    account: null, themeMode: 'light', fontSize: 'medium', language: 'system',
    themeChoices: [], fontChoices: [], languageChoices: [], legalLinks: [], needsSummary: 'Needs', version: '1',
  } as unknown as SettingsPanelProps['model'];
  return <SettingsPanel model={model} />;
}

beforeEach(() => { mockScheme = 'light'; usePreferencesStore.getState().resetPreferences(); });

it.each(['light', 'dark'] as const)('%s: the settings switch updates native form colors immediately and restores defaults when disabled', async scheme => {
  mockScheme = scheme;
  const view = await render(<Settings />);
  const initialFormModifiers = view.getByTestId('Form').props.modifiers;
  await fireEvent(view.getAllByTestId('Toggle')[0], 'isOnChange', true);
  expect(usePreferencesStore.getState().highContrast).toBe(true);
  expect(view.getByTestId('Host').props.seedColor).toBe(semanticColors(scheme === 'dark', true).accent);
  expect(view.getByTestId('Form').props.modifiers).not.toEqual(initialFormModifiers);
  expect(JSON.stringify(view.getByTestId('Form').props.modifiers)).toContain(Colors[scheme === 'dark' ? 'dark-hc' : 'light-hc'].backgroundElement);
  await fireEvent(view.getAllByTestId('Toggle')[0], 'isOnChange', false);
  expect(view.getByTestId('Host').props.seedColor).toBeUndefined();
  expect(view.getByTestId('Form').props.modifiers).toEqual(initialFormModifiers);
});

it('high contrast replaces glass with an opaque surface while preserving its content', async () => {
  const view = await render(<GlassCard><View testID="content" /></GlassCard>);
  expect(view.getByTestId('glass')).toBeTruthy();
  await act(() => usePreferencesStore.getState().setPreferences({ highContrast: true }));
  expect(view.queryByTestId('glass')).toBeNull();
  expect(view.getByTestId('content')).toBeTruthy();
  await act(() => usePreferencesStore.getState().setPreferences({ highContrast: false }));
  expect(view.getByTestId('glass')).toBeTruthy();
});
