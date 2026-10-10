import { useAuthStore, type UserDTO } from '@/features/auth';
import { getAuthPort } from '@/shared/api';
import { flushPromises } from '@/shared/testing/flushPromises';
import { resetRefreshLaneForTests } from '@/features/auth/domain/authRefresh';
import { getPlaceReviews, getReviewSummary } from '@/features/place/api/reviews';
import { getHazardReport, getNearbyHazardReports } from '@/features/hazard/api/hazardApi';
import { getBlockedUsers } from '../contentSafetyApi';

// Keep the real store, AuthPort registration, refresh coordinator and fetchRequest.
// Only environment storage and the transport boundary are replaced.
// Barrel narrowing avoids loading unrelated native screens, while retaining the actual store modules.
jest.mock('@/features/auth', () => jest.requireActual('@/features/auth/store/authStore'));
jest.mock('@/features/content-safety', () => jest.requireActual('@/features/content-safety/store/contentSafetyStore'));
jest.mock('@/shared/config', () => ({ getAppConfig: () => ({ apiBaseUrl: 'https://api.test' }) }));
jest.mock('@/shared/storage', () => ({ getSecureItem: async () => null, setSecureItem: async () => undefined, deleteSecureItem: async () => undefined }));
const originalFetch = globalThis.fetch;
const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>();
function login(id: string) {
  const user: UserDTO = { _id: id, name: id, email: `${id}@example.test`, authProviders: ['local'], emailVerified: true, tokenVersion: 0 };
  useAuthStore.setState({ user, session: { accessToken: id, refreshToken: `${id}-refresh` } });
}
function response(code: number, data?: unknown, token?: string): Response {
  return { status: code, ok: code < 400, statusText: '', json: async () => ({ ok: code < 400, status: code < 400 ? 'success' : 'error', code, message: 'test', data, ...(token ? { accessToken: token, refreshToken: `${token}-refresh` } : {}) }) } as Response;
}
function deferred() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>(r => { resolve = r; });
  return { promise, resolve };
}
const publicReads = [
  ['review list', () => getPlaceReviews({ placeId: 'place', placeType: 'google' })],
  ['review summary', () => getReviewSummary({ placeId: 'place', placeType: 'google' })],
  ['nearby hazards', () => getNearbyHazardReports(25, 121)],
  ['hazard detail', () => getHazardReport('111111111111111111111111')],
] as const;
const allReads = [...publicReads, ['blocked users', () => getBlockedUsers()] as const];
beforeEach(() => {
  resetRefreshLaneForTests();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as typeof fetch;
  useAuthStore.setState({ user: null, session: null });
  login('A');
});
afterEach(() => { globalThis.fetch = originalFetch; });

it.each(allReads)('%s: late A 401 cannot refresh/retry or invalidate B', async (_name, read) => {
  const old = deferred();
  fetchMock.mockReturnValueOnce(old.promise);
  expect(getAuthPort().getSession()).toBe(useAuthStore.getState().session);
  const pending = read();
  const assertion = expect(pending).rejects.toMatchObject({ reason: 'REQUEST_SUPERSEDED' });
  login('B');
  old.resolve(response(401));
  await assertion;
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(useAuthStore.getState().session?.accessToken).toBe('B');
});
it.each(publicReads)('%s: anonymous response cannot be adopted after login', async (_name, read) => {
  useAuthStore.setState({ user: null, session: null });
  const old = deferred();
  fetchMock.mockReturnValueOnce(old.promise);
  const pending = read();
  const assertion = expect(pending).rejects.toMatchObject({ reason: 'REQUEST_SUPERSEDED' });
  login('B');
  old.resolve(response(200, {}));
  await assertion;
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty('Authorization');
});
it('real refresh transport succeeds and replays a same-account personalized read with its new token', async () => {
  fetchMock.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(200, undefined, 'A-new')).mockResolvedValueOnce(response(200, { items: [] }));
  expect(await getBlockedUsers()).toEqual([]);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls[1][0]).toBe('https://api.test/api/v1/user/refresh');
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ refreshToken: 'A-refresh' });
  expect(fetchMock.mock.calls[2][1]?.headers).toMatchObject({ Authorization: 'Bearer A-new' });
  expect(useAuthStore.getState().session?.accessToken).toBe('A-new');
});
it('account switching during real refresh discards its outcome without replay', async () => {
  const refresh = deferred();
  fetchMock.mockResolvedValueOnce(response(401)).mockReturnValueOnce(refresh.promise);
  const pending = getBlockedUsers();
  const assertion = expect(pending).rejects.toMatchObject({ reason: 'REQUEST_SUPERSEDED' });
  await flushPromises();
  expect(fetchMock.mock.calls[1][0]).toBe('https://api.test/api/v1/user/refresh');
  login('B');
  refresh.resolve(response(200, undefined, 'A-new'));
  await assertion;
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(useAuthStore.getState().session?.accessToken).toBe('B');
});
it('late A response cannot be adopted after A → B → A', async () => {
  const old = deferred();
  fetchMock.mockReturnValueOnce(old.promise);
  const pending = getBlockedUsers();
  const assertion = expect(pending).rejects.toMatchObject({ reason: 'REQUEST_SUPERSEDED' });
  login('B'); login('A');
  old.resolve(response(200, { items: [] }));
  await assertion;
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
