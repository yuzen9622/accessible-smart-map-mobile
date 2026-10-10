import { useAuthStore } from '@/features/auth';
import { syncPushToken } from '../pushService';
const mockDelete = jest.fn<Promise<void>, unknown[]>(async () => {});
const mockToken = jest.fn(async () => ({ data: 'Expo[legacy-token]' }));
jest.mock('../api/pushTokenApi', () => ({ registerPushToken: jest.fn(), unregisterPushToken: (...args: unknown[]) => mockDelete(...args) }));
jest.mock('expo-notifications', () => ({ getPermissionsAsync: async () => ({ status: 'granted' }), getExpoPushTokenAsync: () => mockToken() }));
jest.mock('@/features/auth', () => ({ useAuthStore: jest.requireActual('zustand').create(() => ({})) }));
jest.mock('@/shared/storage', () => ({ ...jest.requireActual('@/shared/storage'), getSecureItem: async () => null, setSecureItem: async () => {} }));
jest.mock('@/shared/preferences', () => ({ usePreferencesStore: jest.requireActual('zustand').create(() => ({ notifications: false })) }));
it('recovers an old-version token on cold start and deletes the backend registration while disabled', async () => {
  useAuthStore.setState({ restored: true, user: { _id: 'A' } as never, session: { accessToken: 'A' } });
  expect(await syncPushToken()).toBe('disabled');
  expect(mockToken).toHaveBeenCalledTimes(1);
  expect(mockDelete).toHaveBeenCalledWith('Expo[legacy-token]', 'A');
});
