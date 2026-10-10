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
        json: async () => ({ status: 'error', code: 403, message: 'Forbidden' }),
      }),
    );

    await expect(authenticatedRequest('http://test.local/api/v1/thing')).rejects.toThrow(ApiError);
    expect(refresh).not.toHaveBeenCalled();
    expect(fake.port.invalidateSession).toHaveBeenCalledTimes(1);
  });
});

describe('fetchRequest 403 business errors (native-only)', () => {
  it.each([
    [{ status: 'error', code: 403, message: '您不是此求救的發起者', data: { reason: 'NOT_SESSION_OWNER' } }],
    [{ status: 'error', code: 403, message: '無權限修改此評價' }],
  ])('does not invalidate the session for an ownership 403 %#', async (body) => {
    const fake = makeFakeAuthPort({ accessToken: 'token' });
    configureAuthPort(fake.port);
    const fetchMock = installFetchMock();
    fetchMock.mockResolvedValueOnce(makeResponse({ status: 403, ok: false, json: async () => body }));

    await expect(authenticatedRequest('http://test.local/api/v1/thing')).rejects.toThrow(ApiError);
    expect(fake.port.invalidateSession).not.toHaveBeenCalled();
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

describe('fetchRequest timeout', () => {
  function hangingFetch(): FetchMock {
    const fetchMock = installFetchMock();
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = (init as RequestInit | undefined)?.signal;
          signal?.addEventListener('abort', () => reject(new Error('AbortError')));
        }),
    );
    return fetchMock;
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects with a 408 REQUEST_TIMEOUT ApiError after the default timeout', async () => {
    jest.useFakeTimers();
    hangingFetch();
    const pending = fetchRequest('http://test.local/api/v1/slow');
    const assertion = expect(pending).rejects.toMatchObject({ name: 'ApiError', code: 408, reason: 'REQUEST_TIMEOUT' });
    jest.advanceTimersByTime(20_000);
    await assertion;
  });

  it('honours a per-request timeoutMs', async () => {
    jest.useFakeTimers();
    hangingFetch();
    const pending = fetchRequest('http://test.local/api/v1/slow', { timeoutMs: 1_000 });
    const assertion = expect(pending).rejects.toBeInstanceOf(ApiError);
    jest.advanceTimersByTime(1_000);
    await assertion;
  });

  it('rethrows the original error when the caller aborts', async () => {
    hangingFetch();
    const controller = new AbortController();
    const pending = fetchRequest('http://test.local/api/v1/slow', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow('AbortError');
  });
});

describe('authenticated mutation owner fence', () => {
  const unauthorized = () => makeResponse({ status: 401, ok: false, json: async () => ({ status: 'error', code: 401, message: 'expired' }) });
  it('never sends an already superseded mutation', async () => {
    const fetchMock = installFetchMock();
    await expect(authenticatedRequest('http://test.local/api/v1/content-reports', { method: 'POST', isCurrent: () => false })).rejects.toMatchObject({ reason: 'REQUEST_SUPERSEDED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(['POST', 'PUT', 'DELETE'])('does not refresh or replay a stale %s after a new account logs in', async method => {
    const fake = makeFakeAuthPort({ accessToken: 'A' });
    let current = true;
    const refresh = jest.fn(async () => 'B-new');
    configureAuthPort({ ...fake.port, refresh });
    const fetchMock = installFetchMock();
    fetchMock.mockImplementationOnce(async () => {
      fake.setSession({ accessToken: 'B' });
      current = false;
      return unauthorized();
    });
    await expect(authenticatedRequest('http://test.local/api/v1/content-reports', { method, isCurrent: () => current })).rejects.toMatchObject({ reason: 'REQUEST_SUPERSEDED' });
    expect(refresh).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('rechecks ownership after refresh before it can replay a mutation', async () => {
    const fake = makeFakeAuthPort({ accessToken: 'A' });
    let current = true;
    configureAuthPort({ ...fake.port, refresh: async () => {
      fake.setSession({ accessToken: 'B' });
      current = false;
      return 'B';
    } });
    const fetchMock = installFetchMock();
    fetchMock.mockResolvedValueOnce(unauthorized());
    await expect(authenticatedRequest('http://test.local/api/v1/user/blocks', { method: 'PUT', isCurrent: () => current })).rejects.toMatchObject({ reason: 'REQUEST_SUPERSEDED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('still refreshes and retries a mutation for the same account', async () => {
    const fake = makeFakeAuthPort({ accessToken: 'A-old' });
    configureAuthPort({ ...fake.port, refresh: async () => { fake.setSession({ accessToken: 'A-new' }); return 'A-new'; } });
    const fetchMock = installFetchMock();
    fetchMock.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(makeResponse({ status: 200, ok: true, json: async () => ({ ok: true, code: 200, status: 'success', message: 'ok' }) }));
    const result = await authenticatedRequest('http://test.local/api/v1/user/blocks', { method: 'PUT', isCurrent: () => true });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ headers: { Authorization: 'Bearer A-new' } });
  });
});
