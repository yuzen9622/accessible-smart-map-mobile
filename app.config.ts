import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * 靜態設定在 app.json；這裡只放「依環境變數決定」的部分。
 *
 * Google 登入 plugin 在沒有 `iosUrlScheme` 時會讓 prebuild 直接 throw，而 iOS client ID 屬於
 * 個人／環境設定（`.env.local`），所以只在有設定時才加 plugin。iOS URL scheme 是 client ID 反轉：
 * `<prefix>.apps.googleusercontent.com` → `com.googleusercontent.apps.<prefix>`。
 */
function googleIosUrlScheme(clientId: string | undefined): string | null {
  const suffix = '.apps.googleusercontent.com';
  const value = clientId?.trim();
  if (!value || !value.endsWith(suffix)) return null;
  return `com.googleusercontent.apps.${value.slice(0, -suffix.length)}`;
}

/**
 * 免費 Apple ID（Personal Team）不能簽推播、Sign in with Apple、App Groups 這三種 entitlement，
 * 裝到自己的 iPhone 做真機測試時會簽章失敗。只在本機 prebuild 時設 `IOS_FREE_SIGNING=1`，
 * 暫時拿掉產生這些 entitlement 的 plugin，並以 `plugins/with-free-signing.ts` 刪掉 Expo 自動加回的部分
 * （Live Activity、Apple 登入、遠端推播在這種 build 不可用）；
 * EAS 與正式 build 不設這個變數，不受影響。
 */
const FREE_SIGNING_EXCLUDED_PLUGINS = new Set(['expo-widgets', 'expo-apple-authentication', 'expo-notifications']);

function pluginName(plugin: NonNullable<ExpoConfig['plugins']>[number]): string {
  return Array.isArray(plugin) ? String(plugin[0]) : String(plugin);
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosUrlScheme = googleIosUrlScheme(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
  const freeSigning = process.env.IOS_FREE_SIGNING === '1';
  let plugins = [...(config.plugins ?? [])];
  if (iosUrlScheme) {
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme }]);
  }
  if (freeSigning) {
    plugins = [
      './plugins/with-free-signing.ts',
      ...plugins.filter((plugin) => !FREE_SIGNING_EXCLUDED_PLUGINS.has(pluginName(plugin))),
    ];
  }
  return {
    ...config,
    name: config.name ?? '無障礙智慧地圖',
    slug: config.slug ?? 'accessible-smart-map-mobile',
    plugins,
    ios: freeSigning ? { ...config.ios, usesAppleSignIn: false } : config.ios,
  };
};
