/**
 * 使用者偏好（純型別與純函式，可在 node 下測）。
 *
 * 對應 Web `useAuthStore.userConfig`（commit f82cda8）。Web 把偏好塞在 auth store 裡；本 repo
 * 依 ADR-14 拆出來放共用層，因為主題／高對比要給 `shared/theme`、語系要給 `shared/i18n` 用，
 * 而 shared 不得 import feature。登入後與伺服器 `/user/config` 的同步由 `features/settings` 負責。
 */

export type ThemeMode = 'system' | 'light' | 'dark';
export type FontSizeLevel = 'small' | 'medium' | 'large' | 'mega';
/** `system`＝跟隨裝置語系（`expo-localization`）。 */
export type LanguagePreference = 'system' | 'zh-TW' | 'en';

export interface Preferences {
  themeMode: ThemeMode;
  /** Web 版也只存在本機、不同步到帳號（`settingsHighContrastLocalHint`）。 */
  highContrast: boolean;
  fontSize: FontSizeLevel;
  language: LanguagePreference;
  /** 使用者同意接收推播（實際權限以系統為準）。 */
  notifications: boolean;
  /** AI 記憶總開關（Phase 4 使用；先同步設定值）。 */
  memoryEnabled: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  themeMode: 'system',
  highContrast: false,
  fontSize: 'medium',
  language: 'system',
  notifications: false,
  memoryEnabled: true,
};

/**
 * App 內字級倍率，疊加在系統 Dynamic Type 之上。比例取自 Web `fontSizeConfig` 的
 * `--font-size-base`（14／16／20／22 px，以 16 為 1）。
 */
export const FONT_SCALE: Record<FontSizeLevel, number> = {
  small: 0.875,
  medium: 1,
  large: 1.25,
  mega: 1.375,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** 讀回的持久化資料逐欄驗證，壞欄位退回預設值。 */
export function sanitizePreferences(value: unknown): Preferences {
  if (!isRecord(value)) return DEFAULT_PREFERENCES;
  const themeMode = value.themeMode;
  const fontSize = value.fontSize;
  const language = value.language;
  return {
    themeMode: themeMode === 'light' || themeMode === 'dark' || themeMode === 'system' ? themeMode : 'system',
    highContrast: value.highContrast === true,
    fontSize:
      fontSize === 'small' || fontSize === 'medium' || fontSize === 'large' || fontSize === 'mega' ? fontSize : 'medium',
    language: language === 'zh-TW' || language === 'en' || language === 'system' ? language : 'system',
    notifications: value.notifications === true,
    memoryEnabled: value.memoryEnabled !== false,
  };
}
