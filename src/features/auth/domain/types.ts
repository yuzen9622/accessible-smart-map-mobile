/**
 * 使用者型別，移植自 Web `src/types/user.d.ts`（commit f82cda8）。
 * Web 版以 `lib/config.ts` 的 enum 表示語系／字級／主題色；本 repo 禁止 enum 以外的
 * 寬鬆型別也不需要 enum 的執行期物件，改用字面值聯集，值與後端 `Config` schema 一致。
 */

export type ThemeColor = 'default' | 'red' | 'blue' | 'green' | 'purple' | 'orange' | 'yellow';
export type FontSizeLevel = 'small' | 'medium' | 'large' | 'mega';
export type ConfigLanguage = 'en' | 'zh-TW';
export type DarkModePreference = 'light' | 'dark' | 'system';

export interface UserDTO {
  _id?: string;
  name: string;
  email: string;
  avatar?: string;
  /** null＝從未連結 Google 的帳號（只有 email／密碼）。 */
  client_id?: string | null;
  /** "google" | "local" | "apple"；Google 使用者設定密碼後會同時有兩個。 */
  authProviders: string[];
  emailVerified: boolean;
  tokenVersion: number;
  lineUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserConfig {
  language: ConfigLanguage;
  darkMode: DarkModePreference;
  themeColor: ThemeColor;
  fontSize: FontSizeLevel;
  notifications: boolean;
  highContrast: boolean;
  memoryEnabled: boolean;
  user_id?: string;
}

export interface LineLinkCodeResult {
  bindCode: string;
  bindCodeExpiresAt: string;
  bindUrl: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isUserDTO(value: unknown): value is UserDTO {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.email === 'string' &&
    Array.isArray(value.authProviders) &&
    value.authProviders.every((p) => typeof p === 'string') &&
    typeof value.emailVerified === 'boolean'
  );
}

const CONFIG_KEYS = ['language', 'darkMode', 'themeColor', 'fontSize', 'notifications', 'highContrast', 'memoryEnabled'] as const;

/**
 * 後端 config 文件的欄位可能缺漏（舊帳號、schema 新增欄位前建立的文件），只挑出型別正確的欄位，
 * 由呼叫端與本機預設值合併。
 */
export function pickUserConfig(value: unknown): Partial<UserConfig> {
  if (!isRecord(value)) return {};
  const out: Partial<UserConfig> = {};
  for (const key of CONFIG_KEYS) {
    const v = value[key];
    switch (key) {
      case 'language':
        if (v === 'en' || v === 'zh-TW') out.language = v;
        break;
      case 'darkMode':
        if (v === 'light' || v === 'dark' || v === 'system') out.darkMode = v;
        break;
      case 'themeColor':
        if (
          v === 'default' ||
          v === 'red' ||
          v === 'blue' ||
          v === 'green' ||
          v === 'purple' ||
          v === 'orange' ||
          v === 'yellow'
        ) {
          out.themeColor = v;
        }
        break;
      case 'fontSize':
        if (v === 'small' || v === 'medium' || v === 'large' || v === 'mega') out.fontSize = v;
        break;
      default:
        if (typeof v === 'boolean') out[key] = v;
    }
  }
  return out;
}
