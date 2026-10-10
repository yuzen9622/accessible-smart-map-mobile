import { useAuthStore } from '@/features/auth';
import { usePreferencesStore } from '@/shared/preferences';
import i18n from '@/shared/i18n';
import { ApiError, configureAuthPort } from '@/shared/api';
import { syncPushToken, unregisterSessionPush, usePushStatus } from '../pushService';

const mockPost = jest.fn();
const mockDelete = jest.fn();
const mockToken = jest.fn();
const mockPermission = jest.fn();
jest.mock('../api/pushTokenApi', () => ({
  registerPushToken: (...args: unknown[]) => mockPost(...args),
  unregisterPushToken: (...args: unknown[]) => mockDelete(...args),
}));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockPermission(),
  getExpoPushTokenAsync: () => mockToken(),
}));
jest.mock('@/features/auth', () => ({ useAuthStore: jest.requireActual('zustand').create(() => ({})) }));
jest.mock('@/shared/storage', () => ({ ...jest.requireActual('@/shared/storage'), getSecureItem: async () => null, setSecureItem: async () => {} }));
jest.mock('@/shared/preferences', () => ({ usePreferencesStore: jest.requireActual('zustand').create(() => ({ notifications: true })) }));
function login(id = 'A', token = 'access-A') {
  useAuthStore.setState({ restored: true, user: { _id: id } as never, session: { accessToken: token } });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { resolve, promise };
}
beforeEach(async () => {
  mockPost.mockReset().mockResolvedValue(undefined);
  mockDelete.mockReset().mockResolvedValue(undefined);
  mockToken.mockReset().mockResolvedValue({ data: 'Expo[token]' });
  mockPermission.mockReset().mockResolvedValue({ status: 'granted' });
  usePreferencesStore.setState({ notifications: false });
  login();
  await syncPushToken(); // clear any previous binding through the real queue
  mockDelete.mockClear();
  usePreferencesStore.setState({ notifications: true });
  await i18n.changeLanguage('zh-TW');
});

it('distinguishes token retrieval from failed registration and retries POST', async () => {
  mockPost.mockRejectedValueOnce(new Error('offline'));
  expect(await syncPushToken()).toBe('registrationError');
  expect(usePushStatus.getState().status).toBe('registrationError');
  expect(await syncPushToken()).toBe('registered');
  expect(mockPost).toHaveBeenCalledTimes(2);
});
it('reports token failure without claiming registration', async () => {
  mockToken.mockRejectedValueOnce(new Error('no entitlement'));
  expect(await syncPushToken()).toBe('tokenError');
  expect(mockPost).not.toHaveBeenCalled();
});
it('does not POST an obsolete token acquisition under a new account', async () => {
  const token = deferred<{ data: string }>();
  const started = deferred<void>();
  mockToken.mockImplementationOnce(() => { started.resolve(); return token.promise; });
  const first = syncPushToken();
  await started.promise;
  login('B', 'access-B');
  const second = syncPushToken();
  token.resolve({ data: 'Expo[token]' });
  await first;
  expect(await second).toBe('registered');
  expect(mockPost).toHaveBeenCalledTimes(1);
  expect(mockPost.mock.calls[0][1]).toBe('access-B');
});
it('serializes stale POST cleanup before registering the next account', async () => {
  const post = deferred<void>();
  const started = deferred<void>();
  mockPost.mockImplementationOnce(() => { started.resolve(); return post.promise; });
  const first = syncPushToken();
  await started.promise;
  login('B', 'access-B');
  const second = syncPushToken();
  post.resolve();
  await first;
  await second;
  expect(mockDelete).toHaveBeenCalledWith('Expo[token]', 'access-A');
  expect(mockDelete.mock.invocationCallOrder[0]).toBeLessThan(mockPost.mock.invocationCallOrder[1]);
  expect(mockPost.mock.calls[1][1]).toBe('access-B');
});
it('disabling during POST deletes the registration, then enabling registers again', async () => {
  const post = deferred<void>();
  const started = deferred<void>();
  mockPost.mockImplementationOnce(() => { started.resolve(); return post.promise; });
  const first = syncPushToken();
  await started.promise;
  usePreferencesStore.setState({ notifications: false });
  const disable = syncPushToken();
  post.resolve();
  await first;
  expect(await disable).toBe('disabled');
  expect(mockDelete).toHaveBeenCalledWith('Expo[token]', 'access-A');
  usePreferencesStore.setState({ notifications: true });
  expect(await syncPushToken()).toBe('registered');
});
it('logout waits for POST and uses the captured session for DELETE', async () => {
  const post = deferred<void>();
  const started = deferred<void>();
  mockPost.mockImplementationOnce(() => { started.resolve(); return post.promise; });
  const first = syncPushToken();
  await started.promise;
  const captured = useAuthStore.getState().session!;
  useAuthStore.setState({ user: null, session: null });
  const logout = unregisterSessionPush(captured);
  post.resolve();
  await Promise.all([first, logout]);
  expect(mockDelete).toHaveBeenCalledWith('Expo[token]', 'access-A');
  expect(await syncPushToken()).toBe('signedOut');
});
it('retries failed DELETE and syncs language and replacement session', async () => {
  await syncPushToken();
  mockDelete.mockRejectedValueOnce(new Error('offline'));
  usePreferencesStore.setState({ notifications: false });
  expect(await syncPushToken()).toBe('unregisterError');
  expect(await syncPushToken()).toBe('disabled');
  usePreferencesStore.setState({ notifications: true });
  login('A', 'access-new-session');
  await i18n.changeLanguage('en');
  expect(await syncPushToken()).toBe('registered');
  expect(mockPost).toHaveBeenLastCalledWith(expect.objectContaining({ locale: 'en' }), 'access-new-session');
});
it('permission revoked in system settings unregisters an existing token', async () => {
  await syncPushToken();
  mockPermission.mockResolvedValue({ status: 'denied' });
  expect(await syncPushToken()).toBe('denied');
  expect(mockDelete).toHaveBeenCalledWith('Expo[token]', 'access-A');
});

it('expired current credentials refresh once and POST with the refreshed bearer', async () => {
  const refresh = jest.fn(async () => {
    useAuthStore.setState({ session: { accessToken: 'refreshed-A' } });
    return 'refreshed-A';
  });
  configureAuthPort({ getSession: () => useAuthStore.getState().session, refresh, invalidateSession: jest.fn() });
  mockPost.mockRejectedValueOnce(new ApiError('Expired', 401));
  expect(await syncPushToken()).toBe('registered');
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(mockPost).toHaveBeenLastCalledWith(expect.anything(), 'refreshed-A');
});
it('expired credentials still unregister when the preference is disabled', async () => {
  await syncPushToken();
  const refresh = jest.fn(async () => {
    useAuthStore.setState({ session: { accessToken: 'refreshed-A' } });
    return 'refreshed-A';
  });
  configureAuthPort({ getSession: () => useAuthStore.getState().session, refresh, invalidateSession: jest.fn() });
  mockDelete.mockRejectedValueOnce(new ApiError('Expired', 401));
  usePreferencesStore.setState({ notifications: false });
  mockPermission.mockRejectedValue(new Error('OS permission read failed'));
  expect(await syncPushToken()).toBe('disabled');
  expect(mockDelete).toHaveBeenCalledWith('Expo[token]', 'refreshed-A');
});
it('never retries POST under an account that replaced a refreshing session', async () => {
  const refresh = jest.fn(async () => { login('B', 'access-B'); return null; });
  configureAuthPort({ getSession: () => useAuthStore.getState().session, refresh, invalidateSession: jest.fn() });
  mockPost.mockRejectedValueOnce(new ApiError('Expired', 401));
  await syncPushToken();
  expect(mockPost).toHaveBeenCalledTimes(1);
  expect(mockPost.mock.calls[0][1]).toBe('access-A');
});
