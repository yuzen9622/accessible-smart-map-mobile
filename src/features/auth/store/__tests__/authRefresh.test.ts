import { fetchRequest, type ApiResponse } from '@/shared/api';

import {
  configureAuthState,
  invalidateSession,
  refreshAccessToken,
  resetRefreshLaneForTests,
  type AuthSession,
  type AuthStatePort,
} from '../../domain/authRefresh';
import type { UserDTO } from '../../domain/types';
import { useAuthStore } from '../authStore';
import { requestRefresh } from '../../api/authTransport';

/**
 * 移植自 Web `src/lib/__tests__/authRefresh.test.ts`（commit f82cda8），案例編號沿用。
 * 與 Web 一樣接真正的 zustand store（import 時自動註冊 port）與真正的 `fetchRequest`，只 stub 全域 fetch。
 *
 * 差異：
 * - 原生 refresh 以 body 傳 refresh token（B-01），session 一律帶 `refreshToken`；成功回應帶輪替後的新 token。
 * - 回應要是完整的 `ApiResponse` 信封（本 repo 的 fetch 會以 type guard 收窄），helper 補上 status／code／message。
 * - case 20b：revoke 改為 `credentials: 'omit'` + JSON body 的 refresh token，仍不帶 Authorization。
 */

jest.mock('@/shared/config', () => ({
  getAppConfig: () => ({ apiBaseUrl: 'https://api.test' }),
}));

jest.mock('@/shared/storage', () => ({
  getSecureItem: async () => null,
  setSecureItem: async () => undefined,
  deleteSecureItem: async () => undefined,
}));

const END_POINT = 'https://api.test';

function makeUser(id: string): UserDTO {
  return {
    _id: id,
    name: id,
    email: `${id}@test.dev`,
    client_id: id,
    authProviders: ['google'],
    emailVerified: true,
    tokenVersion: 0,
  };
}

function session(token: string): AuthSession {
  return { accessToken: token, refreshToken: `${token}-rt` };
}

function resetStore() {
  useAuthStore.setState({ user: null, session: null, sessionExpired: false });
}

function jsonResponse(body: Record<string, unknown>): Response {
  const code = typeof body.code === 'number' ? body.code : body.ok === false ? 401 : 200;
  const envelope = {
    status: body.ok === false ? 'error' : 'success',
    code,
    message: 'm',
    ...body,
  };
  return { status: code, ok: code < 400, statusText: '', json: async () => envelope } as unknown as Response;
}

function refreshOk(accessToken: string): Response {
  return jsonResponse({ ok: true, accessToken, refreshToken: `${accessToken}-rotated` });
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function makeDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  for (let i = 0; i < 50; i++) {
    await Promise.resolve();
  }
}

type FetchInit = RequestInit | undefined;
type FetchMock = jest.Mock<Promise<Response>, [string, RequestInit?]>;

function stubFetch(handlers: {
  refresh?: (init: FetchInit) => Response | Promise<Response>;
  logout?: (init: FetchInit) => Response | Promise<Response>;
  endpoint?: (url: string, init: FetchInit) => Response | Promise<Response>;
}): FetchMock {
  const fetchMock: FetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/api/v1/user/refresh')) {
      if (!handlers.refresh) {
        throw new Error('unexpected refresh call');
      }
      return handlers.refresh(init);
    }
    if (url.includes('/api/v1/user/logout')) {
      return handlers.logout ? handlers.logout(init) : jsonResponse({ ok: true });
    }
    if (handlers.endpoint) {
      return handlers.endpoint(url, init);
    }
    throw new Error(`unexpected fetch url: ${url}`);
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function realPort(): AuthStatePort {
  return {
    getSession: () => useAuthStore.getState().session,
    setSession: (s) => useAuthStore.getState().setSession(s),
    setUser: (user) => useAuthStore.getState().setUser(user),
    requestRefresh,
  };
}

beforeEach(() => {
  resetRefreshLaneForTests();
  resetStore();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('authRefresh single-flight (case 19)', () => {
  it('calls the refresh endpoint exactly once for N concurrent callers, all resolve the same token, store committed once', async () => {
    useAuthStore.setState({ user: makeUser('u1'), session: session('old') });
    const fetchMock = stubFetch({
      refresh: (init) => {
        expect(init?.method).toBe('POST');
        expect(init?.credentials).toBe('omit');
        expect((init?.headers as Record<string, string>)['X-Client']).toBe('mobile');
        expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
        expect(JSON.parse(String(init?.body))).toEqual({ refreshToken: 'old-rt' });
        return refreshOk('new-token');
      },
    });

    const results = await Promise.all([refreshAccessToken(), refreshAccessToken(), refreshAccessToken()]);

    const refreshCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/v1/user/refresh'));
    expect(refreshCalls).toHaveLength(1);
    expect(String(refreshCalls[0][0])).toBe(`${END_POINT}/api/v1/user/refresh`);
    expect(results).toEqual(['new-token', 'new-token', 'new-token']);
    expect(useAuthStore.getState().session).toEqual({
      accessToken: 'new-token',
      refreshToken: 'new-token-rotated',
    });
    expect(useAuthStore.getState().user).toEqual(makeUser('u1'));
  });

  it('on failure clears accessToken and user; never leaves user=null with a non-empty token', async () => {
    useAuthStore.setState({ user: makeUser('u1'), session: session('old') });
    stubFetch({ refresh: () => jsonResponse({ ok: false, code: 401 }) });

    const result = await refreshAccessToken();

    expect(result).toBeNull();
    expect(useAuthStore.getState().session?.accessToken).toBe('');
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().sessionExpired).toBe(true);
  });

  it('native-only: a network failure keeps the stored session (refresh token must survive offline cold starts)', async () => {
    const s = session('old');
    useAuthStore.setState({ user: makeUser('u1'), session: s });
    stubFetch({ refresh: () => Promise.reject(new TypeError('Network request failed')) });

    expect(await refreshAccessToken()).toBeNull();
    expect(useAuthStore.getState().session).toBe(s);
    expect(useAuthStore.getState().user).toEqual(makeUser('u1'));
  });

  it('native-only: 5xx and 429 are transient, not a rejection', async () => {
    const s = session('old');
    useAuthStore.setState({ user: makeUser('u1'), session: s });
    stubFetch({ refresh: () => jsonResponse({ ok: false, code: 503 }) });
    expect(await refreshAccessToken()).toBeNull();
    stubFetch({ refresh: () => jsonResponse({ ok: false, code: 429 }) });
    expect(await refreshAccessToken()).toBeNull();
    expect(useAuthStore.getState().session).toBe(s);
  });
});

describe('useAuthStore logout race (case 20)', () => {
  const logoutSettlements = [
    { name: 'logout still pending', settle: (_d: Deferred<Response>) => {} },
    { name: 'logout resolves', settle: (d: Deferred<Response>) => d.resolve(jsonResponse({ ok: true })) },
    { name: 'logout rejects', settle: (d: Deferred<Response>) => d.reject(new Error('network down')) },
  ];
  const refreshOutcomes = ['success', 'failure'] as const;

  for (const scenario of logoutSettlements) {
    for (const outcome of refreshOutcomes) {
      it(`${scenario.name} + refresh ${outcome} -> session stays null, not revived`, async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        useAuthStore.setState({ user: makeUser('u1'), session: session('old') });
        const refreshDeferred = makeDeferred<Response>();
        const logoutDeferred = makeDeferred<Response>();
        stubFetch({ refresh: () => refreshDeferred.promise, logout: () => logoutDeferred.promise });

        const refreshPromise = refreshAccessToken();
        await flush();

        useAuthStore.getState().logout();
        expect(useAuthStore.getState().session).toBeNull();
        expect(useAuthStore.getState().user).toBeNull();

        scenario.settle(logoutDeferred);
        if (outcome === 'success') {
          refreshDeferred.resolve(refreshOk('new-token'));
        } else {
          refreshDeferred.resolve(jsonResponse({ ok: false, code: 401 }));
        }

        const result = await refreshPromise;
        await flush();

        expect(result).toBeNull();
        expect(useAuthStore.getState().session).toBeNull();
        expect(useAuthStore.getState().user).toBeNull();
      });
    }
  }

  it('opens a fresh lane on the next call after a discarded logout race', async () => {
    useAuthStore.setState({ user: makeUser('u1'), session: session('old') });
    const refreshDeferred = makeDeferred<Response>();
    stubFetch({ refresh: () => refreshDeferred.promise });

    const first = refreshAccessToken();
    await flush();
    useAuthStore.getState().logout();
    refreshDeferred.resolve(refreshOk('stale'));
    expect(await first).toBeNull();

    useAuthStore.setState({ user: makeUser('B'), session: session('B-token') });
    stubFetch({ refresh: () => refreshOk('B-new') });
    const second = await refreshAccessToken();
    expect(second).toBe('B-new');
  });
});

describe('useAuthStore.logout synchronization (case 20b)', () => {
  it('clears user/session synchronously, revokes via a raw fetch without Authorization, never touches the refresh transport', async () => {
    useAuthStore.setState({ user: makeUser('u1'), session: session('old-token') });
    let capturedHeaders: Record<string, string> | undefined;
    let capturedCredentials: RequestCredentials | undefined;
    let capturedBody: unknown;
    const fetchMock = stubFetch({
      logout: (init) => {
        capturedHeaders = init?.headers as Record<string, string> | undefined;
        capturedCredentials = init?.credentials;
        capturedBody = JSON.parse(String(init?.body));
        return jsonResponse({ ok: true });
      },
    });

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().session).toBeNull();

    await flush();

    expect(capturedHeaders?.Authorization).toBeUndefined();
    expect(capturedHeaders?.['X-Client']).toBe('mobile');
    expect(capturedCredentials).toBe('omit');
    expect(capturedBody).toEqual({ refreshToken: 'old-token-rt' });
    const refreshCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/v1/user/refresh'));
    expect(refreshCalls).toHaveLength(0);
  });

  it('does not throw when revoke rejects; state stays cleared', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    useAuthStore.setState({ user: makeUser('u1'), session: session('old-token') });
    stubFetch({ logout: () => Promise.reject(new Error('network down')) });

    expect(() => useAuthStore.getState().logout()).not.toThrow();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().session).toBeNull();

    await flush();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().session).toBeNull();
  });
});

describe('fetch 401 integration (case 23)', () => {
  it('shares one lane with a concurrent direct caller, transport called once, retry carries the new Authorization', async () => {
    useAuthStore.setState({ user: makeUser('u1'), session: session('old-token') });
    const refreshDeferred = makeDeferred<Response>();
    const endpointDeferred1 = makeDeferred<Response>();
    const endpointDeferred2 = makeDeferred<Response>();
    let refreshCalls = 0;
    let endpointCallCount = 0;
    const endpointAuthHeaders: (string | undefined)[] = [];

    stubFetch({
      refresh: () => {
        refreshCalls++;
        return refreshDeferred.promise;
      },
      endpoint: (_url, init) => {
        endpointCallCount++;
        endpointAuthHeaders.push((init?.headers as Record<string, string> | undefined)?.Authorization);
        return endpointCallCount === 1 ? endpointDeferred1.promise : endpointDeferred2.promise;
      },
    });

    const directRefreshCall = refreshAccessToken();
    await flush();
    expect(refreshCalls).toBe(1);

    const fetchResultPromise = fetchRequest(`${END_POINT}/some-endpoint`, { requireAuth: true });
    await flush();
    endpointDeferred1.resolve(jsonResponse({ ok: false, code: 401 }));
    await flush();

    expect(refreshCalls).toBe(1);

    refreshDeferred.resolve(refreshOk('new-token'));
    await flush();
    endpointDeferred2.resolve(jsonResponse({ ok: true, data: 'result' }));

    const [directResult, result] = await Promise.all([directRefreshCall, fetchResultPromise]);

    expect(refreshCalls).toBe(1);
    expect(directResult).toBe('new-token');
    expect(endpointCallCount).toBe(2);
    expect(endpointAuthHeaders[0]).toBe('Bearer old-token');
    expect(endpointAuthHeaders[1]).toBe('Bearer new-token');
    expect((result as ApiResponse<string>).data).toBe('result');
  });

  it('10 concurrent expired requests trigger exactly one refresh (ROADMAP Phase 3 exit criterion)', async () => {
    useAuthStore.setState({ user: makeUser('u1'), session: session('old-token') });
    let refreshCalls = 0;
    stubFetch({
      refresh: async () => {
        refreshCalls++;
        await flush();
        return refreshOk('new-token');
      },
      endpoint: (_url, init) => {
        const auth = (init?.headers as Record<string, string>).Authorization;
        return auth === 'Bearer new-token' ? jsonResponse({ ok: true, data: 1 }) : jsonResponse({ ok: false, code: 401 });
      },
    });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => fetchRequest(`${END_POINT}/some-endpoint`, { requireAuth: true })),
    );

    expect(refreshCalls).toBe(1);
    expect(results.every((r) => r.data === 1)).toBe(true);
  });
});

describe('no retry after a logout-discarded refresh (case 24)', () => {
  it('resolves null and does not retry when refreshAccessToken discards due to a concurrent logout', async () => {
    useAuthStore.setState({ user: makeUser('u1'), session: session('old-token') });
    const refreshDeferred = makeDeferred<Response>();
    let endpointCalls = 0;
    stubFetch({
      refresh: () => refreshDeferred.promise,
      endpoint: () => {
        endpointCalls++;
        return jsonResponse({ ok: false, code: 401 });
      },
    });

    const fetchResultPromise = fetchRequest(`${END_POINT}/some-endpoint`, { requireAuth: true });
    await flush();
    useAuthStore.getState().logout();
    refreshDeferred.resolve(refreshOk('new-token'));

    const result = await fetchResultPromise;

    expect(endpointCalls).toBe(1);
    expect(useAuthStore.getState().session).toBeNull();
    expect(result.code).toBe(401);
  });
});

describe('ABA relogin race (case 25)', () => {
  it('does not commit a stale refresh success onto a newly logged-in session', async () => {
    useAuthStore.setState({ user: makeUser('A'), session: session('A-token') });
    const refreshDeferred = makeDeferred<Response>();
    stubFetch({ refresh: () => refreshDeferred.promise });

    const stalePromise = refreshAccessToken();
    await flush();

    useAuthStore.getState().logout();
    const bSession = session('B-token');
    useAuthStore.setState({ user: makeUser('B'), session: bSession });

    refreshDeferred.resolve(refreshOk('stale-new-token'));
    const staleResult = await stalePromise;

    expect(staleResult).toBeNull();
    expect(useAuthStore.getState().session).toBe(bSession);
    expect(useAuthStore.getState().user).toEqual(makeUser('B'));
  });

  it('does not invalidate a newly logged-in session when the stale refresh fails', async () => {
    useAuthStore.setState({ user: makeUser('A'), session: session('A-token') });
    const refreshDeferred = makeDeferred<Response>();
    stubFetch({ refresh: () => refreshDeferred.promise });

    const stalePromise = refreshAccessToken();
    await flush();

    useAuthStore.getState().logout();
    const bSession = session('B-token');
    useAuthStore.setState({ user: makeUser('B'), session: bSession });

    refreshDeferred.resolve(jsonResponse({ ok: false, code: 401 }));
    const staleResult = await stalePromise;

    expect(staleResult).toBeNull();
    expect(useAuthStore.getState().session).toBe(bSession);
    expect(useAuthStore.getState().user).toEqual(makeUser('B'));
  });
});

describe('retry-still-401 does not recurse (case 27)', () => {
  it('refreshes once, retries once, invalidates via compare-and-commit, and returns the 401 as-is', async () => {
    useAuthStore.setState({ user: makeUser('u1'), session: session('old-token') });
    let refreshCalls = 0;
    let endpointCalls = 0;
    stubFetch({
      refresh: () => {
        refreshCalls++;
        return refreshOk('new-token');
      },
      endpoint: () => {
        endpointCalls++;
        return jsonResponse({ ok: false, code: 401 });
      },
    });

    const result = await fetchRequest(`${END_POINT}/some-endpoint`, { requireAuth: true });

    expect(refreshCalls).toBe(1);
    expect(endpointCalls).toBe(2);
    expect(useAuthStore.getState().session?.accessToken).toBe('');
    expect(useAuthStore.getState().user).toBeNull();
    expect(result.code).toBe(401);
  });

  it('does not clear a session that was replaced during the retry window', async () => {
    useAuthStore.setState({ user: makeUser('u1'), session: session('old-token') });
    const endpointDeferred2 = makeDeferred<Response>();
    let endpointCalls = 0;
    let replaced: AuthSession | null = null;
    stubFetch({
      refresh: () => refreshOk('new-token'),
      endpoint: () => {
        endpointCalls++;
        if (endpointCalls === 1) {
          return jsonResponse({ ok: false, code: 401 });
        }
        replaced = session('replaced-token');
        useAuthStore.setState({ session: replaced });
        return endpointDeferred2.promise;
      },
    });

    const resultPromise = fetchRequest(`${END_POINT}/some-endpoint`, { requireAuth: true });
    await flush();
    endpointDeferred2.resolve(jsonResponse({ ok: false, code: 401 }));
    await resultPromise;

    expect(useAuthStore.getState().session).toBe(replaced);
  });
});

describe('cross-identity lane isolation & reentrant merge (case 28)', () => {
  it('merges N (>=3) new-identity callers into exactly one new lane once the stale lane settles', async () => {
    useAuthStore.setState({ user: makeUser('A'), session: session('A-token') });
    const refreshADeferred = makeDeferred<Response>();
    const refreshBDeferred = makeDeferred<Response>();
    let refreshCallCount = 0;
    stubFetch({
      refresh: () => {
        refreshCallCount++;
        return refreshCallCount === 1 ? refreshADeferred.promise : refreshBDeferred.promise;
      },
    });

    const aPromise = refreshAccessToken();
    await flush();

    useAuthStore.getState().logout();
    useAuthStore.setState({ user: makeUser('B'), session: session('B-token') });

    const bCallers = [refreshAccessToken(), refreshAccessToken(), refreshAccessToken()];
    await flush();
    expect(refreshCallCount).toBe(1);

    refreshADeferred.resolve(refreshOk('stale-A-new-token'));
    await flush();
    expect(refreshCallCount).toBe(2);

    refreshBDeferred.resolve(refreshOk('B-new-token'));

    const [aResult, ...bResults] = await Promise.all([aPromise, ...bCallers]);

    expect(refreshCallCount).toBe(2);
    expect(aResult).toBeNull();
    expect(bResults).toEqual(['B-new-token', 'B-new-token', 'B-new-token']);
    expect(useAuthStore.getState().session?.accessToken).toBe('B-new-token');
  });

  it('discards a B lane and merges into a single C lane when identity changes again while B waits', async () => {
    useAuthStore.setState({ user: makeUser('A'), session: session('A-token') });
    const refreshADeferred = makeDeferred<Response>();
    const refreshBDeferred = makeDeferred<Response>();
    const refreshCDeferred = makeDeferred<Response>();
    let refreshCallCount = 0;
    stubFetch({
      refresh: () => {
        refreshCallCount++;
        if (refreshCallCount === 1) return refreshADeferred.promise;
        if (refreshCallCount === 2) return refreshBDeferred.promise;
        return refreshCDeferred.promise;
      },
    });

    const aPromise = refreshAccessToken();
    await flush();
    useAuthStore.getState().logout();
    useAuthStore.setState({ user: makeUser('B'), session: session('B-token') });

    const bPromise = refreshAccessToken();
    refreshADeferred.resolve(refreshOk('stale'));
    await flush();
    expect(refreshCallCount).toBe(2);

    useAuthStore.getState().logout();
    useAuthStore.setState({ user: makeUser('C'), session: session('C-token') });

    const cCallers = [refreshAccessToken(), refreshAccessToken()];
    await flush();
    expect(refreshCallCount).toBe(2);

    refreshBDeferred.resolve(refreshOk('stale-B'));
    await flush();
    expect(refreshCallCount).toBe(3);

    refreshCDeferred.resolve(refreshOk('C-new-token'));

    const [aResult, bResult, ...cResults] = await Promise.all([aPromise, bPromise, ...cCallers]);

    expect(aResult).toBeNull();
    expect(bResult).toBeNull();
    expect(cResults).toEqual(['C-new-token', 'C-new-token']);
    expect(useAuthStore.getState().session?.accessToken).toBe('C-new-token');
  });

  it('resolves null without throwing when the auth-state port has not been configured', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    configureAuthState(null);
    try {
      await expect(refreshAccessToken()).resolves.toBeNull();
    } finally {
      configureAuthState(realPort());
    }
  });
});

describe('invalidateSession compare-and-invalidate', () => {
  it('clears state only when the passed reference still matches the current session', () => {
    const s = session('token');
    useAuthStore.setState({ user: makeUser('u1'), session: s });

    invalidateSession({ accessToken: 'different-object-same-shape' });
    expect(useAuthStore.getState().session).toBe(s);

    invalidateSession(s);
    expect(useAuthStore.getState().session?.accessToken).toBe('');
    expect(useAuthStore.getState().user).toBeNull();
  });
});
