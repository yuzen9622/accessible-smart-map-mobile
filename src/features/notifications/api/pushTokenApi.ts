import { ApiError, fetchRequest } from '@/shared/api';

/**
 * `POST|DELETE /api/v1/user/push-tokens`。token 綁定的是「這次登入的 session」而不是帳號：
 * 每次登入後都要重新登記；重複登記是冪等的。
 */
const PATH = '/api/v1/user/push-tokens';

export interface PushTokenRegistration {
  token: string;
  platform: 'ios' | 'android';
  locale: string;
}

export async function registerPushToken(input: PushTokenRegistration, accessToken: string): Promise<void> {
  const res = await fetchRequest(PATH, { method: 'POST', body: input, headers: { Authorization: `Bearer ${accessToken}` } });
  if (!(res.ok || res.success)) throw new ApiError(res.message, res.code);
}

/**
 * 用擷取的 bearer 註銷，不自動改用後來登入的帳號。
 * 401 交由 pushService 判斷是否仍能替原身分續期；登出則沿用 captured session。
 */
export async function unregisterPushToken(token: string, accessToken: string): Promise<void> {
  const res = await fetchRequest(PATH, {
    method: 'DELETE',
    body: { token },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!(res.ok || res.success)) throw new ApiError(res.message, res.code);
}
