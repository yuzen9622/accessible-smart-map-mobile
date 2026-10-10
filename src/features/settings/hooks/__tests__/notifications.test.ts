import { act, renderHook } from '@testing-library/react-native';
import { useAuthStore } from '@/features/auth';
import { usePreferencesStore } from '@/shared/preferences';
import { usePushStatus } from '@/features/notifications';
import { flushPromises } from '@/shared/testing/flushPromises';
import { useSettingsViewModel } from '../useSettingsViewModel';
const mockSync = jest.fn();
const mockPermission = jest.fn();
jest.mock('@/features/auth', () => ({
  useAuthStore: jest.requireActual('zustand').create(() => ({})),
  selectIsLoggedIn: (s: { user: unknown; session?: { accessToken: string } }) => Boolean(s.user && s.session?.accessToken),
}));
jest.mock('@/features/notifications', () => ({
  syncPushToken: () => mockSync(), requestPushPermission: () => mockPermission(),
  usePushStatus: jest.requireActual('zustand').create(() => ({ status: 'registered' })),
}));
jest.mock('@/features/onboarding', () => ({ useOnboardingStore: jest.requireActual('zustand').create(() => ({ profile: { situations: [] } })) }));
jest.mock('@/shared/config', () => ({ getAppConfig: () => ({}) }));
jest.mock('@/shared/preferences', () => ({ usePreferencesStore: jest.requireActual('zustand').create((set: (v: unknown) => void) => ({ notifications: true, setPreferences: set })) }));
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
beforeEach(() => {
  mockSync.mockReset().mockResolvedValue('registered');
  mockPermission.mockReset().mockResolvedValue('granted');
  useAuthStore.setState({ restored: true, user: { _id: 'A', authProviders: [] } as never, session: { accessToken: 'A' } });
  usePreferencesStore.setState({ notifications: true });
  usePushStatus.setState({ status: 'registered' });
});
it('turning off updates the preference and invokes backend synchronization', async () => {
  const { result } = await renderHook(useSettingsViewModel);
  await act(async () => { result.current.setNotifications(false); await flushPromises(); });
  expect(usePreferencesStore.getState().notifications).toBe(false);
  expect(mockSync).toHaveBeenCalledTimes(1);
});
it('turning on requests permission before registering', async () => {
  usePreferencesStore.setState({ notifications: false });
  const { result } = await renderHook(useSettingsViewModel);
  await act(async () => { result.current.setNotifications(true); await flushPromises(); });
  expect(usePreferencesStore.getState().notifications).toBe(true);
  expect(mockPermission).toHaveBeenCalledTimes(1);
  expect(mockSync).toHaveBeenCalledTimes(1);
});
it('a late permission grant cannot undo a newer disable action', async () => {
  let grant!: (value: string) => void;
  mockPermission.mockReturnValue(new Promise((r) => { grant = r; }));
  const { result } = await renderHook(useSettingsViewModel);
  await act(async () => { result.current.setNotifications(true); result.current.setNotifications(false); grant('granted'); await flushPromises(); });
  expect(usePreferencesStore.getState().notifications).toBe(false);
  expect(mockSync).toHaveBeenCalledTimes(1);
});
it.each(['tokenError', 'registrationError', 'unregisterError'] as const)('%s exposes a visible retry action', async (status) => {
  usePushStatus.setState({ status });
  const { result } = await renderHook(useSettingsViewModel);
  expect(result.current.notificationStatusText).toBeTruthy();
  expect(result.current.notificationAction).not.toBeNull();
  await act(async () => { result.current.notificationAction?.(); });
  expect(mockSync).toHaveBeenCalledTimes(1);
});
