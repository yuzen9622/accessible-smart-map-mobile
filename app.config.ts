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

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosUrlScheme = googleIosUrlScheme(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
  const plugins = [...(config.plugins ?? [])];
  if (iosUrlScheme) {
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme }]);
  }
  return { ...config, name: config.name ?? '臺北無障礙導航', slug: config.slug ?? 'accessible-smart-map-mobile', plugins };
};
