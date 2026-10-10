import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/features/auth';
import { usePreferencesStore } from '@/shared/preferences';
import { refreshMyReports } from '@/features/hazard';
import { useNotificationsBootstrap } from '../hooks/useNotificationsBootstrap';
import { flushPromises } from '@/shared/testing/flushPromises';
const mockSync = jest.fn(async () => 'registered');
const mockClear = jest.fn();
let mockLast: unknown = null;
let mockRoot: unknown = { key: 'root' };
let mockReceive: (notification: unknown) => void;
const mockRemove = jest.fn();
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  useLastNotificationResponse: () => mockLast,
  clearLastNotificationResponse: () => mockClear(),
  addNotificationReceivedListener: (callback: typeof mockReceive) => { mockReceive = callback; return { remove: mockRemove }; },
  addPushTokenListener: () => ({ remove: mockRemove }),
}));
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() }, useRootNavigationState: () => mockRoot }));
jest.mock('@/features/auth', () => ({
  useAuthStore: jest.requireActual('zustand').create(() => ({})),
  selectIsLoggedIn: (s: { user: unknown; session?: { accessToken: string } }) => Boolean(s.user && s.session?.accessToken),
  onLogout: () => () => {},
}));
jest.mock('@/features/hazard', () => ({ refreshMyReports: jest.fn() }));
jest.mock('../pushService', () => ({ syncPushToken: () => mockSync(), unregisterSessionPush: jest.fn(), usePushStatus: { setState: jest.fn() } }));
jest.mock('@/shared/preferences', () => ({ usePreferencesStore: jest.requireActual('zustand').create(() => ({ notifications: true })) }));
let counter = 0;
function notification(notificationId: string, identifier: string) {
  return { request: { identifier, content: { data: { type: 'hazard_review', reportId: '507f1f77bcf86cd799439011', notificationId } } } };
}
function login() { useAuthStore.setState({ restored: true, user: { _id: 'A' } as never, session: { accessToken: 'A' } }); }
beforeEach(() => {
  jest.clearAllMocks();
  mockSync.mockResolvedValue('registered');
  counter += 1;
  mockLast = { notification: notification(`507f1f77bcf86cd799439011:${counter}`, `request-${counter}`) };
  mockRoot = { key: 'root' };
  useAuthStore.setState({ restored: false, user: null, session: null });
});
it('waits for restore and root navigation, retains target across login, then opens detail', async () => {
  mockRoot = undefined;
  const { rerender } = await renderHook(useNotificationsBootstrap);
  expect(router.navigate).not.toHaveBeenCalled();
  await act(async () => { useAuthStore.setState({ restored: true }); });
  expect(router.navigate).not.toHaveBeenCalled();
  mockRoot = { key: 'root' };
  await rerender({});
  expect(router.navigate).toHaveBeenLastCalledWith('/auth');
  expect(mockClear).not.toHaveBeenCalled();
  await act(async () => { login(); await flushPromises(); });
  expect(router.navigate).toHaveBeenLastCalledWith({ pathname: '/settings/report/[id]', params: { id: '507f1f77bcf86cd799439011' } }, { withAnchor: true });
  expect(refreshMyReports).toHaveBeenCalled();
  expect(mockClear).toHaveBeenCalled();
});
it('deduplicates notificationId across native identifiers and hook remounts', async () => {
  login();
  const { unmount } = await renderHook(useNotificationsBootstrap);
  await unmount();
  mockLast = { notification: notification(`507f1f77bcf86cd799439011:${counter}`, 'another-native-request') };
  await renderHook(useNotificationsBootstrap);
  expect(router.navigate).toHaveBeenCalledTimes(1);
});
it('foreground receipt refreshes without navigation and cleans up listeners', async () => {
  mockLast = null;
  login();
  const { unmount } = await renderHook(useNotificationsBootstrap);
  await act(async () => { mockReceive(notification('507f1f77bcf86cd799439011:99', 'foreground')); });
  expect(refreshMyReports).toHaveBeenCalledTimes(1);
  expect(router.navigate).not.toHaveBeenCalled();
  await unmount();
  expect(mockRemove).toHaveBeenCalled();
});
it('resyncs after session changes, disabling and app foreground', async () => {
  mockLast = null;
  login();
  const listener = jest.spyOn(AppState, 'addEventListener');
  await renderHook(useNotificationsBootstrap);
  const initial = mockSync.mock.calls.length;
  await act(async () => { useAuthStore.setState({ session: { accessToken: 'new-session' } }); await flushPromises(); });
  await act(async () => { usePreferencesStore.setState({ notifications: false }); await flushPromises(); });
  const callback = listener.mock.calls[listener.mock.calls.length - 1][1];
  await act(async () => { callback('active'); await flushPromises(); });
  expect(mockSync.mock.calls.length).toBeGreaterThanOrEqual(initial + 3);
  listener.mockRestore();
});
