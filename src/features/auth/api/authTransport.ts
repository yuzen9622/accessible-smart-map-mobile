import { isApiResponse, timedFetch } from '@/shared/api';
import { getAppConfig } from '@/shared/config';
import { logger } from '@/shared/logger';

import type { AuthSession, RefreshOutcome } from '../domain/authRefresh';
import { isUserDTO } from '../domain/types';

/**
 * 原始 auth transport，移植自 Web `src/lib/authTransport.ts`（commit f82cda8）。
 *
 * 與 Web 一樣直接用全域 `fetch`、不經過 `fetchRequest`，因此不可能觸發 401-refresh 遞迴。
 * 差異（後端 B-01，`accessible-smart-map-backend#25`）：原生不用 httpOnly cookie，而是帶
 * `X-Client: mobile` 並在 JSON body 傳 `{ refreshToken }`；後端會拒絕同時帶 cookie（MIXED_TOKEN_SOURCES）
 * 與任何 `Authorization` header，所以 `credentials: 'omit'`、不帶 Authorization。
 */

const MOBILE_HEADERS = {
  'Content-Type': 'application/json',
  'X-Client': 'mobile',
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function requestRefresh(session: AuthSession | null): Promise<RefreshOutcome> {
  const refreshToken = session?.refreshToken;
  if (!refreshToken) {
    // 沒有 refresh token（未登入，或已失效的 `{ accessToken: '' }`）＝一定會被拒絕，不必打網路。
    return { kind: 'rejected' };
  }
  let response: Response;
  try {
    // 續期是 single-flight：卡住會讓所有等它的請求一起卡住，逾時就當暫時不可用
    response = await timedFetch(`${getAppConfig().apiBaseUrl}/api/v1/user/refresh`, {
      method: 'POST',
      headers: MOBILE_HEADERS,
      credentials: 'omit',
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return { kind: 'unavailable' };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return response.status === 401 || response.status === 403 ? { kind: 'rejected' } : { kind: 'unavailable' };
  }
  if (isApiResponse(body) && (body.ok === true || body.success === true) && body.accessToken) {
    const data = isRecord(body.data) ? body.data : undefined;
    return {
      kind: 'ok',
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      user: data && isUserDTO(data.user) ? data.user : undefined,
    };
  }
  // 401／403／400（token 格式錯）＝伺服器明確拒絕；429、5xx 是暫時性的。
  if (response.status === 429 || response.status >= 500) {
    return { kind: 'unavailable' };
  }
  return { kind: 'rejected' };
}

/**
 * 在後端撤銷這個 refresh token 對應的 session。永不 reject，失敗只記 log（對齊 Web `revokeSession`）。
 */
export async function revokeSession(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  try {
    await timedFetch(`${getAppConfig().apiBaseUrl}/api/v1/user/logout`, {
      method: 'POST',
      headers: MOBILE_HEADERS,
      credentials: 'omit',
      body: JSON.stringify({ refreshToken }),
    });
  } catch (error) {
    logger.error('[authTransport] revokeSession failed', error);
  }
}
