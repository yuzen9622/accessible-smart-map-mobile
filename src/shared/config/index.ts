import { parseAppConfig, type AppConfig } from './appConfig';

export { parseAppConfig } from './appConfig';
export type { AppConfig, AppConfigEnv, AppConfigResult } from './appConfig';
export { default as ConfigErrorScreen } from './ConfigErrorScreen';

// Expo 只會在 build 時內嵌「直接寫出名稱」的 process.env.EXPO_PUBLIC_* 存取，
// 所以每個變數都要逐一列出，不能用動態 key 或解構 process.env。
export const appConfigResult = parseAppConfig({
  EXPO_PUBLIC_END_POINT: process.env.EXPO_PUBLIC_END_POINT,
  EXPO_PUBLIC_SHARE_BASE_URL: process.env.EXPO_PUBLIC_SHARE_BASE_URL,
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  EXPO_PUBLIC_PRIVACY_POLICY_URL: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
  EXPO_PUBLIC_TERMS_URL: process.env.EXPO_PUBLIC_TERMS_URL,
});

/**
 * 取得已驗證的設定。只在 root layout 確認 appConfigResult.ok 之後的畫面使用；
 * 設定無效時 root layout 會改顯示 ConfigErrorScreen，不會渲染這些畫面。
 */
export function getAppConfig(): AppConfig {
  if (!appConfigResult.ok) {
    throw new Error(`App 設定無效：${appConfigResult.errors.join('；')}`);
  }
  return appConfigResult.config;
}
