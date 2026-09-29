import { authenticatedRequest, fetchRequest } from '@/shared/api';

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

export async function registerPushToken(input: PushTokenRegistration): Promise<void> {
  await authenticatedRequest(PATH, { method: 'POST', body: input });
}

/**
 * 登出時註銷。此時 store 的 session 已被同步清掉，所以用登出前擷取的 access token 自行帶 header，
 * 而且不走 401-refresh（`requireAuth: false`）：token 過期就算了，後端推送失敗時也會自行清掉失效 token。
 */
export async function unregisterPushToken(token: string, accessToken: string): Promise<void> {
  await fetchRequest(PATH, {
    method: 'DELETE',
    body: { token },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
