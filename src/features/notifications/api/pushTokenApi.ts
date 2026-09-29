import { authenticatedRequest, fetchRequest } from '@/shared/api';

/**
 * B-04 草案：`POST|DELETE /api/v1/user/push-tokens`（Expo push token、平台、語系）。
 * 後端尚未實作；呼叫端以 `backendCapabilities.pushTokens` 控制是否真的送出。
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
