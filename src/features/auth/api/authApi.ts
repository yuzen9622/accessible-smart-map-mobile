import { ApiError, authenticatedRequest, fetchRequest, type ApiResponse } from '@/shared/api';

import { refreshAccessToken } from '../domain/authRefresh';
import { isUserDTO, type LineLinkCodeResult, type UserDTO } from '../domain/types';
import type { SessionPayload } from '../store/authStore';

/**
 * 移植自 Web `src/lib/api/{auth,user}.ts`（commit f82cda8）。
 *
 * 差異：
 * - 所有請求由 `fetchRequest` 帶 `X-Client: mobile`（後端 B-01）：登入類回應在 body 同時回傳
 *   `accessToken` 與 `refreshToken`，且原生沒有 Origin header，不帶這個 header 會被 CSRF 檢查擋成 403。
 * - Web 把原始 `ApiResponse` 丟給 UI 自己判斷；本 repo 禁止 `as` 收窄未驗證的資料，改在這層以 type guard
 *   驗證後回傳判別聯集，UI 只處理語意（成功／帳密錯／未驗證…）。
 * - verify-email 與 reset-password 的落地頁留在 Web（使用者決策 2026-09-25），不移植 `verifyEmail`／`resetPassword`。
 */

const USER = '/api/v1/user';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSuccess(res: ApiResponse<unknown>): boolean {
  return res.ok === true || res.success === true;
}

function toSession(res: ApiResponse<unknown>): SessionPayload | null {
  if (!isSuccess(res) || !res.accessToken || !isRecord(res.data) || !isUserDTO(res.data.user)) return null;
  return {
    user: res.data.user,
    config: res.data.config ?? null,
    accessToken: res.accessToken,
    refreshToken: res.refreshToken,
  };
}

export type LoginResult =
  | { kind: 'ok'; session: SessionPayload }
  | { kind: 'invalidCredentials' }
  | { kind: 'emailNotVerified' }
  | { kind: 'rateLimited' }
  | { kind: 'failed'; message?: string };

function classifyLoginError(error: unknown): LoginResult {
  if (error instanceof ApiError) {
    if (error.code === 403 && error.reason === 'EMAIL_NOT_VERIFIED') return { kind: 'emailNotVerified' };
    if (error.code === 429) return { kind: 'rateLimited' };
    return { kind: 'failed', message: error.message };
  }
  throw error;
}

function sessionOrInvalid(res: ApiResponse<unknown>): LoginResult {
  const session = toSession(res);
  if (session) return { kind: 'ok', session };
  // fetchRequest 對 401 不丟例外、原樣回傳（INVALID_CREDENTIALS／INVALID_TOKEN）
  if (res.code === 401) return { kind: 'invalidCredentials' };
  return { kind: 'failed', message: res.message };
}

export async function loginWithEmail(email: string, password: string): Promise<LoginResult> {
  try {
    const res = await fetchRequest(`${USER}/auth/login`, { method: 'POST', body: { email: email.trim(), password } });
    return sessionOrInvalid(res);
  } catch (error) {
    return classifyLoginError(error);
  }
}

export async function loginWithGoogle(idToken: string): Promise<LoginResult> {
  try {
    const res = await fetchRequest(`${USER}/auth/google`, { method: 'POST', body: { idToken } });
    return sessionOrInvalid(res);
  } catch (error) {
    return classifyLoginError(error);
  }
}

export interface AppleLoginInput {
  identityToken: string;
  /** 產生 Apple request 時用的原始 nonce（Apple 收到的是它的 SHA-256）。 */
  nonce: string;
  /** Apple 只在第一次授權時提供姓名。 */
  name?: string | null;
  /** 單次有效、5 分鐘內過期；只有刪除帳號時撤銷 Apple 授權用，登入 API 不接受這個欄位。 */
  authorizationCode?: string | null;
}

/** `POST /api/v1/user/auth/apple`：body 為 `.strict()`，只送 identityToken／nonce／name。 */
export async function loginWithApple(input: AppleLoginInput): Promise<LoginResult> {
  try {
    const body: Record<string, string> = { identityToken: input.identityToken, nonce: input.nonce };
    if (input.name) body.name = input.name.slice(0, 60);
    const res = await fetchRequest(`${USER}/auth/apple`, { method: 'POST', body });
    return sessionOrInvalid(res);
  } catch (error) {
    if (error instanceof ApiError && error.code === 409) return { kind: 'failed', message: error.message };
    return classifyLoginError(error);
  }
}

export type RegisterResult =
  | { kind: 'ok'; emailSent: boolean }
  | { kind: 'emailTaken' }
  | { kind: 'failed'; message?: string };

export async function registerWithEmail(name: string, email: string, password: string): Promise<RegisterResult> {
  try {
    const res = await fetchRequest(`${USER}/auth/register`, {
      method: 'POST',
      body: { name: name.trim(), email: email.trim(), password },
    });
    if (!isSuccess(res)) return { kind: 'failed', message: res.message };
    const emailSent = isRecord(res.data) && typeof res.data.emailSent === 'boolean' ? res.data.emailSent : true;
    return { kind: 'ok', emailSent };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === 409) return { kind: 'emailTaken' };
      return { kind: 'failed', message: error.message };
    }
    throw error;
  }
}

/** 後端一律回同樣的成功訊息（防帳號列舉）。 */
export async function resendVerificationEmail(email: string): Promise<void> {
  await fetchRequest(`${USER}/auth/verify-email/resend`, { method: 'POST', body: { email: email.trim() } });
}

export type ForgotResult = { kind: 'sent' } | { kind: 'unavailable' };

/** 對齊 Web：除了 503（寄信佇列不可用）以外一律視為已寄出（防帳號列舉）。 */
export async function forgotPassword(email: string): Promise<ForgotResult> {
  try {
    await fetchRequest(`${USER}/auth/password/forgot`, { method: 'POST', body: { email: email.trim() } });
    return { kind: 'sent' };
  } catch (error) {
    if (error instanceof ApiError && error.code === 503) return { kind: 'unavailable' };
    if (error instanceof ApiError) return { kind: 'sent' };
    throw error;
  }
}

export type ChangePasswordResult =
  | { kind: 'ok'; user: UserDTO; accessToken: string; refreshToken?: string }
  | { kind: 'wrongCurrentPassword' }
  | { kind: 'currentPasswordRequired' }
  | { kind: 'failed'; message?: string };

/**
 * 401 在這個端點代表「目前密碼錯誤」（業務錯誤），必須 `skipAuthRetry`，否則打錯密碼會被登出
 * （SDD §6.10）。成功後後端會遞增 tokenVersion、撤銷所有舊 session，回應帶新的一組 token。
 */
export async function changePassword(newPassword: string, currentPassword?: string): Promise<ChangePasswordResult> {
  try {
    const send = () =>
      authenticatedRequest(`${USER}/auth/password`, {
        method: 'POST',
        body: currentPassword ? { currentPassword, newPassword } : { newPassword },
        skipAuthRetry: true,
      });
    let res = await send();
    // 401 有兩種：`INVALID_CREDENTIALS`＝目前密碼錯（業務錯誤）；沒有 reason＝access token 過期（60 分鐘）。
    // 後者因 skipAuthRetry 不會自動續期，這裡自己續期並重試一次。
    if (res.code === 401 && reasonOf(res) !== 'INVALID_CREDENTIALS') {
      if (await refreshAccessToken()) res = await send();
    }
    if (res.code === 401) return reasonOf(res) === 'INVALID_CREDENTIALS' ? { kind: 'wrongCurrentPassword' } : { kind: 'failed', message: res.message };
    if (isSuccess(res) && res.accessToken && isRecord(res.data) && isUserDTO(res.data.user)) {
      return { kind: 'ok', user: res.data.user, accessToken: res.accessToken, refreshToken: res.refreshToken };
    }
    return { kind: 'failed', message: res.message };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.reason === 'PASSWORD_REQUIRED') return { kind: 'currentPasswordRequired' };
      return { kind: 'failed', message: error.message };
    }
    throw error;
  }
}

function reasonOf(res: ApiResponse<unknown>): string | undefined {
  return isRecord(res.data) && typeof res.data.reason === 'string' ? res.data.reason : undefined;
}

export interface UserInfo {
  user: UserDTO;
  config: unknown;
}

export async function getUserInfo(): Promise<UserInfo | null> {
  const res = await authenticatedRequest(`${USER}/info`, { method: 'GET' });
  if (isSuccess(res) && isRecord(res.data) && isUserDTO(res.data.user)) {
    return { user: res.data.user, config: res.data.config ?? null };
  }
  return null;
}

function isLineLinkCode(value: unknown): value is LineLinkCodeResult {
  return (
    isRecord(value) &&
    typeof value.bindCode === 'string' &&
    typeof value.bindCodeExpiresAt === 'string' &&
    typeof value.bindUrl === 'string'
  );
}

export async function getLineLinkCode(): Promise<LineLinkCodeResult | null> {
  const res = await authenticatedRequest(`${USER}/line-link-code`, { method: 'POST' });
  return isSuccess(res) && isLineLinkCode(res.data) ? res.data : null;
}

export type DeleteAccountResult =
  | { kind: 'deleted' }
  | { kind: 'reauthRequired' }
  | { kind: 'appleAuthorizationRequired' }
  | { kind: 'appleAuthorizationInvalid' }
  | { kind: 'appleUnavailable' }
  | { kind: 'failed'; message?: string };

/**
 * 刪除帳號（`DELETE /api/v1/user`，App Store 要求）。Apple 帳號必須帶剛取得的 `appleAuthorizationCode`；
 * 403 `REAUTH_REQUIRED`＝這個 session 超過 5 分鐘前登入，refresh 不算重新登入，必須走完整登入流程。
 * 404（帳號已不存在）視同已刪除。後端已自行清 session 與推播 token，不必再呼叫 logout。
 */
export async function deleteAccount(appleAuthorizationCode?: string): Promise<DeleteAccountResult> {
  try {
    const res = await authenticatedRequest(USER, {
      method: 'DELETE',
      body: appleAuthorizationCode ? { appleAuthorizationCode } : {},
    });
    return isSuccess(res) ? { kind: 'deleted' } : { kind: 'failed', message: res.message };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.code === 404) return { kind: 'deleted' };
    if (error.code === 403) {
      if (error.reason === 'REAUTH_REQUIRED') return { kind: 'reauthRequired' };
      if (error.reason === 'APPLE_AUTHORIZATION_REQUIRED') return { kind: 'appleAuthorizationRequired' };
      if (error.reason === 'APPLE_AUTHORIZATION_INVALID') return { kind: 'appleAuthorizationInvalid' };
    }
    if (error.code === 503 && error.reason === 'APPLE_REVOKE_UNAVAILABLE') return { kind: 'appleUnavailable' };
    return { kind: 'failed', message: error.message };
  }
}
