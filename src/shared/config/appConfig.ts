export interface AppConfig {
  /** API base URL（EXPO_PUBLIC_END_POINT），不含結尾斜線 */
  apiBaseUrl: string;
  /** 分享連結網域（EXPO_PUBLIC_SHARE_BASE_URL），不含結尾斜線 */
  shareBaseUrl: string;
  /** Google 登入 web client ID（idToken audience）；Phase 3 前可缺 */
  googleWebClientId: string | null;
  /** Google 登入 iOS client ID；Phase 3 前可缺 */
  googleIosClientId: string | null;
}

export interface AppConfigEnv {
  EXPO_PUBLIC_END_POINT?: string;
  EXPO_PUBLIC_SHARE_BASE_URL?: string;
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?: string;
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?: string;
}

export type AppConfigResult =
  | { ok: true; config: AppConfig }
  | { ok: false; errors: string[] };

function parseBaseUrl(
  name: keyof AppConfigEnv,
  raw: string | undefined,
  errors: string[],
): string {
  const value = raw?.trim();
  if (!value) {
    errors.push(`${name} 未設定`);
    return '';
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    errors.push(`${name} 不是合法 URL：${value}`);
    return '';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    errors.push(`${name} 必須是 http(s) URL：${value}`);
    return '';
  }
  return value.replace(/\/+$/, '');
}

function parseOptional(raw: string | undefined): string | null {
  const value = raw?.trim();
  return value ? value : null;
}

/**
 * 驗證 EXPO_PUBLIC_* 設定。缺值或格式錯誤時回傳錯誤清單，
 * 不以預設值默默連到 localhost（SDD §7.1）。
 */
export function parseAppConfig(env: AppConfigEnv): AppConfigResult {
  const errors: string[] = [];
  const apiBaseUrl = parseBaseUrl('EXPO_PUBLIC_END_POINT', env.EXPO_PUBLIC_END_POINT, errors);
  const shareBaseUrl = parseBaseUrl(
    'EXPO_PUBLIC_SHARE_BASE_URL',
    env.EXPO_PUBLIC_SHARE_BASE_URL,
    errors,
  );
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    config: {
      apiBaseUrl,
      shareBaseUrl,
      googleWebClientId: parseOptional(env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
      googleIosClientId: parseOptional(env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
    },
  };
}
