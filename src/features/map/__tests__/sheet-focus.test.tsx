import { act, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Dimensions } from 'react-native';

import RootLayout from '@/app/_layout';
import { sheetBottomInset } from '../domain/sheetInset';
import { useMapUiStore } from '../store/mapUiStore';

type SheetListeners = {
  focus: () => void;
  sheetDetentChange: (event: { data: { index: number } }) => void;
};
let mockSheetListeners: SheetListeners;
let mockPathname = '/explore';

// Replace the native navigator only; exercise the real root listeners and map UI store.
jest.mock('expo-router', () => {
  const Stack = ({ children }: { children: ReactNode }) => children;
  Stack.Screen = function MockScreen({ name, listeners }: { name: string; listeners: SheetListeners }) {
    if (name === '(sheet)') mockSheetListeners = listeners;
    return null;
  };
  return {
    Stack,
    ThemeProvider: ({ children }: { children: ReactNode }) => children,
    usePathname: () => mockPathname,
  };
});
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@/features/map', () => ({
  ...jest.requireActual('../domain/sheetInset'),
  ...jest.requireActual('../store/mapUiStore'),
  sheetController: { available: false },
}));
jest.mock('@/features/ai', () => ({ useAiBootstrap: () => {} }));
jest.mock('@/features/auth', () => ({ useAuthBootstrap: () => {} }));
jest.mock('@/features/navigation', () => ({
  useNavStore: (select: (state: { isNavigating: boolean }) => unknown) => select({ isNavigating: false }),
}));
jest.mock('@/features/notifications', () => ({ useNotificationsBootstrap: () => {} }));
jest.mock('@/features/settings', () => ({ useSettingsSync: () => {} }));
jest.mock('@/features/sos', () => ({ useSosBootstrap: () => {}, useSosStore: () => false }));
jest.mock('@/shared/config', () => ({ appConfigResult: { ok: true } }));
jest.mock('@/shared/i18n', () => ({ useAppTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/shared/preferences', () => ({ usePreferencesEffects: () => {}, useFontScale: () => 1 }));
jest.mock('@/shared/ui', () => ({ HeaderCloseButton: () => null }));
jest.mock('@/shared/location/backgroundLocation', () => ({}));

beforeEach(() => {
  mockPathname = '/explore';
  useMapUiStore.setState({ sheetDetentIndex: 0, sheetInset: 0 });
});

it.each([0, 1, 2])('returning from a modal preserves sheet detent %i and its content visibility', async (index) => {
  const view = await render(<RootLayout />);
  await act(() => mockSheetListeners.focus());
  await act(() => mockSheetListeners.sheetDetentChange({ data: { index } }));
  const expandedInset = useMapUiStore.getState().sheetInset;

  // Closing chat/settings refocuses the existing sheet without another detent change event.
  for (const modal of ['/chat', '/settings']) {
    mockPathname = modal;
    await view.rerender(<RootLayout />);
    mockPathname = '/explore';
    await view.rerender(<RootLayout />);
    await act(() => mockSheetListeners.focus());
  }

  const state = useMapUiStore.getState();
  expect(state.sheetDetentIndex).toBe(index);
  expect(state.sheetInset).toBe(expandedInset);
  expect(state.sheetInset > sheetBottomInset(0, Dimensions.get('window').height)).toBe(index > 0);
});

it('reads the latest detent after a programmatic height change', async () => {
  await render(<RootLayout />);
  await act(() => mockSheetListeners.focus());
  const inset = sheetBottomInset(2, Dimensions.get('window').height);
  await act(() => useMapUiStore.setState({ sheetDetentIndex: 2, sheetInset: inset }));

  await act(() => mockSheetListeners.focus());

  expect(useMapUiStore.getState()).toMatchObject({ sheetDetentIndex: 2, sheetInset: inset });
});

it('initializes a directly opened place sheet at half, then preserves a later collapse', async () => {
  mockPathname = '/place/example';
  await render(<RootLayout />);
  await act(() => mockSheetListeners.focus());
  expect(useMapUiStore.getState()).toMatchObject({
    sheetDetentIndex: 1,
    sheetInset: sheetBottomInset(1, Dimensions.get('window').height),
  });

  await act(() => mockSheetListeners.sheetDetentChange({ data: { index: 0 } }));
  await act(() => mockSheetListeners.focus());
  expect(useMapUiStore.getState()).toMatchObject({
    sheetDetentIndex: 0,
    sheetInset: sheetBottomInset(0, Dimensions.get('window').height),
  });
});
