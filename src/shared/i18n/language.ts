export const SUPPORTED_LANGUAGES = ['zh-TW', 'en'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const FALLBACK_LANGUAGE: AppLanguage = 'zh-TW';

/** expo-localization `Locale` 中語系判斷用到的欄位 */
export interface DeviceLocale {
  languageCode: string | null;
  languageScriptCode?: string | null;
  regionCode?: string | null;
}

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/**
 * 依裝置偏好語系順序挑第一個支援的語系，取代 Web 的
 * `[lng]` 路由段與 middleware 瀏覽器語言偵測。
 * 任何中文（含簡體）都對應 zh-TW，因為 App 只提供繁中與英文；都不符合時回到 zh-TW（與 Web fallbackLng 一致）。
 */
export function resolveDeviceLanguage(locales: readonly DeviceLocale[]): AppLanguage {
  for (const locale of locales) {
    const code = locale.languageCode?.toLowerCase();
    if (code === 'zh') return 'zh-TW';
    if (code === 'en') return 'en';
  }
  return FALLBACK_LANGUAGE;
}
