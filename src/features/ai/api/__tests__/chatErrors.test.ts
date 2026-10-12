import { fetch as expoFetch } from 'expo/fetch';
import { streamChat } from '../aiApi';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('@/shared/config', () => ({ getAppConfig: () => ({ apiBaseUrl: 'https://api.test' }) }));
const mockRefresh = jest.fn();
let mockSession: { accessToken: string } | undefined;
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  getAuthPort: () => ({ getSession: () => mockSession, refresh: mockRefresh }),
}));

const fetchMock = jest.mocked(expoFetch);
const request = { messages: [{ role: 'user' as const, content: 'route' }], language: 'en' as const };

beforeEach(() => { fetchMock.mockReset(); mockRefresh.mockReset(); mockSession = undefined; });

it('preserves the single 401 refresh retry and sends the same language/body with the refreshed bearer', async () => {
  mockSession = { accessToken: 'expired' };
  mockRefresh.mockResolvedValue('refreshed');
  fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ data: { reason: 'UNAUTHORIZED' } }) } as unknown as Awaited<ReturnType<typeof expoFetch>>)
    .mockResolvedValueOnce({ ok: true, status: 200, body: null } as unknown as Awaited<ReturnType<typeof expoFetch>>);
  await streamChat(request, jest.fn(), new AbortController().signal);
  expect(mockRefresh).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer expired' });
  expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer refreshed' });
  expect(fetchMock.mock.calls[1][1]?.body).toBe(fetchMock.mock.calls[0][1]?.body);
  expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).language).toBe('en');
});

it('reads HTTP data.reason before rejecting and never interprets numeric code as reason', async () => {
  const json = jest.fn(async () => ({ code: 500, reason: 'WRONG_LEVEL', message: 'Safe fallback', data: { reason: 'AI_REQUEST_FAILED' } }));
  fetchMock.mockResolvedValue({ ok: false, status: 500, json } as unknown as Awaited<ReturnType<typeof expoFetch>>);
  await expect(streamChat(request, jest.fn(), new AbortController().signal)).rejects.toMatchObject({
    status: 500, reason: 'AI_REQUEST_FAILED', serverMessage: 'Safe fallback',
  });
  expect(json).toHaveBeenCalledTimes(1);
});

it('keeps HTTP status when a proxy returns a non-JSON error', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => { throw new SyntaxError('not json'); } } as unknown as Awaited<ReturnType<typeof expoFetch>>);
  await expect(streamChat(request, jest.fn(), new AbortController().signal)).rejects.toMatchObject({ status: 429, reason: undefined });
});

it('does not consume a successful SSE body as JSON and still forwards signals', async () => {
  const json = jest.fn();
  const read = jest.fn()
    .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('event: error\ndata: {"code":500,"data":{"reason":"AI_EMPTY_RESPONSE"},"message":"fallback"}\n\n') })
    .mockResolvedValueOnce({ done: true });
  const releaseLock = jest.fn();
  fetchMock.mockResolvedValue({ ok: true, status: 200, json, body: { getReader: () => ({ read, releaseLock }) } } as unknown as Awaited<ReturnType<typeof expoFetch>>);
  const emit = jest.fn();
  await streamChat(request, emit, new AbortController().signal);
  expect(json).not.toHaveBeenCalled();
  expect(emit).toHaveBeenCalledWith({ type: 'error', code: 500, reason: 'AI_EMPTY_RESPONSE', message: 'fallback' });
  expect(releaseLock).toHaveBeenCalledTimes(1);
});
