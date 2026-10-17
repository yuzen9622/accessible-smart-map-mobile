import { act, renderHook } from '@testing-library/react-native';

import { usePreferencesStore } from '@/shared/preferences/preferencesStore';
import { useQuickActions } from '../useQuickActions';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('@/shared/i18n', () => ({
  useAppTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  usePreferencesStore.getState().setPreferences({ quickActions: ['assistant', 'bus', 'hazard', 'train'] });
});

it('returns one entry per enabled quick action key, in the stored order', async () => {
  await act(() => usePreferencesStore.getState().setPreferences({ quickActions: ['hazard', 'assistant'] }));
  const { result } = await renderHook(() => useQuickActions());
  expect(result.current.map((action) => action.key)).toEqual(['hazard', 'assistant']);
});

it('drops an empty quick-action list instead of rendering nothing', async () => {
  await act(() => usePreferencesStore.getState().setPreferences({ quickActions: [] }));
  const { result } = await renderHook(() => useQuickActions());
  expect(result.current).toEqual([]);
});

it('navigates to the matching route when an action is pressed', async () => {
  const { router } = jest.requireMock('expo-router') as { router: { navigate: jest.Mock } };
  const { result } = await renderHook(() => useQuickActions());
  const bus = result.current.find((action) => action.key === 'bus');
  bus!.onPress();
  expect(router.navigate).toHaveBeenCalledWith('/bus');
});
