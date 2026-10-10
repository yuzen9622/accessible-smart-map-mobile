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

/** 首頁「快速服務」可選項目；順序即顯示順序（設定頁依這個順序列勾選項）。 */
export const QUICK_ACTION_KEYS = ['assistant', 'bus', 'hazard'] as const;
export type QuickActionKey = (typeof QUICK_ACTION_KEYS)[number];

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
  /** 首頁「快速服務」要顯示哪些項目、依什麼順序（參考網頁版「首頁快捷方式」，使用者回饋 2026-10-11）。 */
  quickActions: QuickActionKey[];
}

export const DEFAULT_PREFERENCES: Preferences = {
  themeMode: 'system',
  highContrast: false,
  fontSize: 'medium',
  language: 'system',
  notifications: false,
  memoryEnabled: true,
  quickActions: [...QUICK_ACTION_KEYS],
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

function isQuickActionKey(value: unknown): value is QuickActionKey {
  return typeof value === 'string' && (QUICK_ACTION_KEYS as readonly string[]).includes(value);
}

/** 壞資料（型別不對、重複、全部被濾掉）一律退回預設全開，首頁「快速服務」不會開天窗。 */
function sanitizeQuickActions(value: unknown): QuickActionKey[] {
  if (!Array.isArray(value)) return [...QUICK_ACTION_KEYS];
  const deduped = [...new Set(value.filter(isQuickActionKey))];
  return deduped.length > 0 ? deduped : [...QUICK_ACTION_KEYS];
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
    quickActions: sanitizeQuickActions(value.quickActions),
  };
}
