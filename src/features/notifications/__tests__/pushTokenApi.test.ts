import { ApiError } from '@/shared/api';
import { registerPushToken, unregisterPushToken } from '../api/pushTokenApi';
const mockRequest = jest.fn();
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  fetchRequest: (...args: unknown[]) => mockRequest(...args),
}));
beforeEach(() => mockRequest.mockReset());
it('registers with the captured bearer and a minimal body', async () => {
  mockRequest.mockResolvedValue({ ok: true, code: 200 });
  const input = { token: 'Expo[token]', platform: 'ios' as const, locale: 'en' };
  await registerPushToken(input, 'captured-A');
  expect(mockRequest).toHaveBeenCalledWith('/api/v1/user/push-tokens', {
    method: 'POST', body: input, headers: { Authorization: 'Bearer captured-A' },
  });
});
it.each(['POST', 'DELETE'])('%s does not mistake a returned 401 envelope for success', async (method) => {
  mockRequest.mockResolvedValue({ ok: false, code: 401, message: 'Expired' });
  const request = method === 'POST'
    ? registerPushToken({ token: 'Expo[token]', platform: 'android', locale: 'zh-TW' }, 'A')
    : unregisterPushToken('Expo[token]', 'A');
  await expect(request).rejects.toBeInstanceOf(ApiError);
});
