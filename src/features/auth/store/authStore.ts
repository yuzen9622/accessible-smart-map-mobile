import { create } from 'zustand';

import { configureAuthPort } from '@/shared/api';
import { logger } from '@/shared/logger';
import { deleteSecureItem, getSecureItem, setSecureItem } from '@/shared/storage';

import { requestRefresh, revokeSession } from '../api/authTransport';
import {
  configureAuthState,
  invalidateSession,
  refreshAccessToken,
  type AuthSession,
} from '../domain/authRefresh';
import { isUserDTO, type UserConfig, type UserDTO } from '../domain/types';

/**
 * 移植自 Web `src/stores/useAuthStore.ts`（commit f82cda8）的認證部分。
 *
 * 差異（見 port-ledger）：
 * - `userConfig`（語系、主題、字級…）移到 `shared/preferences` 與 `features/settings`（ADR-14：拆掉
 *   Web 把偏好塞進 auth store 的做法）；本 store 只保留登入回應裡的 `remoteConfig` 讓 settings 套用。
 * - `authDialogRequested`／`settingsDialogRequested` 不需要：原生由 Expo Router 路由直接開 modal。
 * - Web 的 access token 只在記憶體、refresh token 在 httpOnly cookie；原生兩者都放 SecureStore
 *   （SDD §7.3），冷啟動由 `restoreSession` 讀回並靜默續期。
 * - logout 仍是同步清除（立即可觀察的登出意圖），但清 AI 對話等跨 feature 的清理改由
 *   `onLogout` 註冊，auth 不 import 其他 feature。
 */

const SESSION_KEY = 'auth.session.v1';
const USER_KEY = 'auth.user.v1';

export interface SessionPayload {
  user: UserDTO;
  config: unknown;
  accessToken: string;
  refreshToken?: string;
}

interface AuthState {
  user: UserDTO | null;
  session: AuthSession | null;
  /** 最近一次登入／`/user/info` 回應中的伺服器端偏好（尚未驗證形狀，由 settings 收窄）。 */
  remoteConfig: unknown;
  /** SecureStore 讀回完成（不論有沒有 session）。 */
  restored: boolean;
  /** 伺服器拒絕續期、session 被清成空值時設為 true；UI 顯示「登入已過期」後呼叫 `clearExpiredNotice`。 */
  sessionExpired: boolean;
}

interface AuthActions {
  setUser: (user: UserDTO | null) => void;
  setSession: (session: AuthSession) => void;
  /** 登入、驗證信自動登入、改密碼（後端會換發新 token）後提交整組 session。 */
  commitSession: (payload: SessionPayload) => void;
  setRemoteConfig: (config: unknown) => void;
  logout: () => void;
  clearExpiredNotice: () => void;
}

export type AuthStore = AuthState & AuthActions;

export type LogoutListener = (captured: AuthSession) => void | Promise<void>;
const logoutListeners = new Set<LogoutListener>();

/**
 * 登出時（同步清除 state 之後）呼叫。收到的是登出前擷取的 session，需要以舊 token 呼叫
 * 後端清理（例：註銷推播 token）的 feature 用它自行帶 Authorization。
 */
export function onLogout(listener: LogoutListener): () => void {
  logoutListeners.add(listener);
  return () => {
    logoutListeners.delete(listener);
  };
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  remoteConfig: null,
  restored: false,
  sessionExpired: false,

  setUser: (user) => set({ user }),
  setSession: (session) => set((state) => ({ session: { ...state.session, ...session } })),
  commitSession: ({ user, config, accessToken, refreshToken }) =>
    set({
      user,
      remoteConfig: config,
      session: { accessToken, refreshToken },
      sessionExpired: false,
    }),
  setRemoteConfig: (config) => set({ remoteConfig: config }),
  clearExpiredNotice: () => set({ sessionExpired: false }),

  logout: () => {
    // 同步登出：先擷取是否有有效 session，同步清掉 state（讓 `session` 立即成為可觀察的登出意圖），
    // 再以原始 fetch 撤銷——永不經過 fetchRequest，所以不可能進 401-refresh 路徑。
    const captured = get().session;
    const hasSession = Boolean(captured || get().user);
    set({ user: null, session: null, remoteConfig: null, sessionExpired: false });
    if (!hasSession) return;
    const refreshToken = captured?.refreshToken;
    void revokeSession(refreshToken);
    if (captured) {
      for (const listener of logoutListeners) {
        void runLogoutListener(listener, captured);
      }
    }
  },
}));

async function runLogoutListener(listener: LogoutListener, captured: AuthSession): Promise<void> {
  try {
    await listener(captured);
  } catch (error) {
    logger.error('[authStore] logout listener failed', error);
  }
}

/** 已登入＝有使用者且 access token 非空。 */
export function selectIsLoggedIn(state: AuthStore): boolean {
  return state.user !== null && Boolean(state.session?.accessToken);
}

// 向 single-flight refresh 協調層註冊 state port（對齊 Web store 建立後立即 `configureAuthState`）。
configureAuthState({
  getSession: () => useAuthStore.getState().session,
  setSession: (session) => {
    // 失效路徑（`{ accessToken: '' }`）只會出現在伺服器拒絕或 compare-and-commit 清除時。
    if (!session.accessToken && useAuthStore.getState().user) {
      useAuthStore.setState({ sessionExpired: true });
    }
    useAuthStore.getState().setSession(session);
  },
  setUser: (user) => useAuthStore.getState().setUser(user),
  requestRefresh,
});

// shared/api 的 fetchRequest 透過 AuthPort 取得 token、觸發 refresh 與 compare-and-commit 失效。
configureAuthPort({
  getSession: () => useAuthStore.getState().session,
  // 對齊 Web fetch.ts：refreshAccessToken 自己讀當下的 session 身分決定 join 或開新 lane。
  refresh: () => refreshAccessToken(),
  invalidateSession: (captured) => invalidateSession(captured),
});

// ── SecureStore 持久化 ────────────────────────────────────────────────

let writeChain: Promise<void> = Promise.resolve();

async function writeCredentials(session: AuthSession | null, user: UserDTO | null): Promise<void> {
  try {
    if (session?.accessToken && session.refreshToken) {
      await setSecureItem(SESSION_KEY, JSON.stringify({ accessToken: session.accessToken, refreshToken: session.refreshToken }));
    } else {
      await deleteSecureItem(SESSION_KEY);
    }
    if (user && session?.accessToken) {
      await setSecureItem(USER_KEY, JSON.stringify(user));
    } else {
      await deleteSecureItem(USER_KEY);
    }
  } catch (error) {
    logger.warn('[authStore] persist credentials failed', error);
  }
}

function schedulePersist(): void {
  // 依序寫入，每次都寫「當下最新」的 state，避免舊的非同步寫入蓋掉新 session。
  const run = async () => {
    await writeChain;
    const { session, user } = useAuthStore.getState();
    await writeCredentials(session, user);
  };
  writeChain = run();
}

let persistEnabled = false;

useAuthStore.subscribe((state, prev) => {
  if (!persistEnabled) return;
  if (state.session !== prev.session || state.user !== prev.user) {
    schedulePersist();
  }
});

function parseStoredSession(raw: string | null): AuthSession | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as Record<string, unknown>).accessToken === 'string' &&
      typeof (value as Record<string, unknown>).refreshToken === 'string'
    ) {
      const record = value as Record<string, string>;
      return { accessToken: record.accessToken, refreshToken: record.refreshToken };
    }
  } catch {
    // 壞掉的資料視為沒有 session
  }
  return null;
}

function parseStoredUser(raw: string | null): UserDTO | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isUserDTO(value) ? value : null;
  } catch {
    return null;
  }
}

let restorePromise: Promise<void> | null = null;

/**
 * 冷啟動：從 SecureStore 讀回 session 後立即靜默續期（後端每次 refresh 都會輪替 refresh token 並回傳
 * 最新使用者）。斷網時保留讀回的 session，之後的請求遇到 401 會再試。只執行一次。
 */
export function restoreSession(): Promise<void> {
  if (!restorePromise) {
    restorePromise = runRestore();
  }
  return restorePromise;
}

async function runRestore(): Promise<void> {
  const [rawSession, rawUser] = await Promise.all([getSecureItem(SESSION_KEY), getSecureItem(USER_KEY)]);
  const session = parseStoredSession(rawSession);
  const user = parseStoredUser(rawUser);
  // 讀回期間使用者可能已經登入（例如很快按了 Google 登入）：那個 session 優先。
  if (session && !useAuthStore.getState().session) {
    useAuthStore.setState({ session, user });
  }
  persistEnabled = true;
  // 讀回期間若已有新登入，subscriber 當時還沒啟用：補寫一次，否則下次冷啟動會讀回舊 session。
  schedulePersist();
  useAuthStore.setState({ restored: true });
  if (session && useAuthStore.getState().session === session) {
    await refreshAccessToken();
  }
}

export type { UserConfig };
