import { configureAuthPort, resetAuthPortForTests, type AuthPort, type AuthSession } from '../auth-port';
import { ApiError, authenticatedRequest, fetchRequest } from '../fetch';

interface FakeResponseInit {
  status: number;
  ok: boolean;
  statusText?: string;
  json?: () => Promise<unknown>;
}

function makeResponse(init: FakeResponseInit): Response {
  return {
    status: init.status,
    ok: init.ok,
    statusText: init.statusText ?? '',
    json: init.json ?? (async () => ({})),
  } as unknown as Response;
}

type FetchMock = jest.Mock<Promise<Response>, [unknown, unknown?]>;

function installFetchMock(): FetchMock {
  const mock: FetchMock = jest.fn();
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

function makeFakeAuthPort(initialSession: AuthSession | null): {
  port: AuthPort;
  setSession: (session: AuthSession | null) => void;
  getSession: () => AuthSession | null;
} {
  let session = initialSession;
  const port: AuthPort = {
    getSession: () => session,
    refresh: jest.fn(async () => null),
    invalidateSession: jest.fn((captured: AuthSession | null) => {
      if (session === captured) {
        session = null;
      }
    }),
  };
  return {
    port,
    setSession: (next) => {
      session = next;
    },
    getSession: () => session,
  };
}

afterEach(() => {
  resetAuthPortForTests();
  jest.restoreAllMocks();
});

describe('fetchRequest 401 refresh-once retry', () => {
  it('refreshes once, retries once with the new token, and returns the retried success response', async () => {
    const fake = makeFakeAuthPort({ accessToken: 'old-token' });
    const refresh = jest.fn(async () => {
      fake.setSession({ accessToken: 'new-token' });
      return 'new-token';
    });
    configureAuthPort({ ...fake.port, refresh });

    const fetchMock = installFetchMock();
    fetchMock
      .mockResolvedValueOnce(
        makeResponse({
          status: 401,
          ok: false,
          json: async () => ({ status: 'error', code: 401, message: 'expired' }),
        }),
      )
      .mockResolvedValueOnce(
        makeResponse({
          status: 200,
          ok: true,
          json: async () => ({ ok: true, status: 'success', code: 200, message: 'ok', data: { value: 1 } }),
        }),
      );

    const result = await authenticatedRequest('http://test.local/api/v1/thing');

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCallInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const secondHeaders = secondCallInit.headers as Record<string, string>;
    expect(secondHeaders.Authorization).toBe('Bearer new-token');
    expect(result).toEqual({ ok: true, status: 'success', code: 200, message: 'ok', data: { value: 1 } });
  });

  it('does not recurse a second time and invalidates via compare-and-commit when the retry is still 401', async () => {
    const fake = makeFakeAuthPort({ accessToken: 'old-token' });
    const refresh = jest.fn(async () => 'new-token');
    const invalidateSession = jest.fn(fake.port.invalidateSession);
    configureAuthPort({ ...fake.port, refresh, invalidateSession });

    const fetchMock = installFetchMock();
    fetchMock.mockResolvedValue(
      makeResponse({
        status: 401,
        ok: false,
        json: async () => ({ status: 'error', code: 401, message: 'still expired' }),
      }),
    );

    const result = await authenticatedRequest('http://test.local/api/v1/thing');

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(invalidateSession).toHaveBeenCalledTimes(1);
    expect(result.code).toBe(401);
  });
});

describe('fetchRequest 403 immediate invalidate', () => {
  it('invalidates the session without attempting a refresh and throws ApiError', async () => {
    const fake = makeFakeAuthPort({ accessToken: 'revoked-token' });
    const refresh = jest.fn(async () => 'should-not-be-called');
    configureAuthPort({ ...fake.port, refresh });

    const fetchMock = installFetchMock();
    fetchMock.mockResolvedValueOnce(
      makeResponse({
        status: 403,
        ok: false,
        json: async () => ({ status: 'error', code: 403, message: 'revoked' }),
      }),
    );

    await expect(authenticatedRequest('http://test.local/api/v1/thing')).rejects.toThrow(ApiError);
    expect(refresh).not.toHaveBeenCalled();
    expect(fake.port.invalidateSession).toHaveBeenCalledTimes(1);
  });
});

describe('fetchRequest skipAuthRetry', () => {
  it('returns the 401 response as-is without refreshing when skipAuthRetry is set', async () => {
    const fake = makeFakeAuthPort({ accessToken: 'token' });
    const refresh = jest.fn(async () => 'new-token');
    configureAuthPort({ ...fake.port, refresh });

    const fetchMock = installFetchMock();
    fetchMock.mockResolvedValueOnce(
      makeResponse({
        status: 401,
        ok: false,
        json: async () => ({ status: 'error', code: 401, message: 'wrong current password' }),
      }),
    );

    const result = await authenticatedRequest('http://test.local/api/v1/user/auth/password', {
      method: 'POST',
      skipAuthRetry: true,
    });

    expect(refresh).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.code).toBe(401);
  });
});

describe('fetchRequest 205 / null data', () => {
  it('treats a bodyless 205 response as success', async () => {
    const fetchMock = installFetchMock();
    fetchMock.mockResolvedValueOnce(
      makeResponse({
        status: 205,
        ok: true,
        statusText: 'Reset Content',
        json: async () => {
          throw new Error('json() must not be called for a 205 response');
        },
      }),
    );

    const result = await fetchRequest('http://test.local/api/v1/emergency-contacts/1', {
      method: 'DELETE',
    });

    expect(result.status).toBe('success');
    expect(result.code).toBe(205);
    expect(result.data).toBeUndefined();
  });
});

describe('fetchRequest non-JSON error body', () => {
  it('synthesizes an error envelope instead of throwing a JSON parse error', async () => {
    const fetchMock = installFetchMock();
    fetchMock.mockResolvedValueOnce(
      makeResponse({
        status: 502,
        ok: false,
        statusText: 'Bad Gateway',
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        },
      }),
    );

    await expect(fetchRequest('http://test.local/api/v1/thing')).rejects.toMatchObject({
      code: 502,
      message: 'Bad Gateway',
    });
  });
});
