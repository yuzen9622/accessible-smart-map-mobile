import type { UserConfig } from '@/features/auth/domain/types';
import type { Preferences } from '@/shared/preferences/preferences';

/**
 * 本機偏好（`shared/preferences`）與伺服器 `/user/config` 的對照。
 *
 * 規則對齊 Web `useAuthStore.updateUserConfig`／`setUserConfig`（commit f82cda8）：
 * - 只送白名單欄位（後端 schema `.strict()`，多送 `user_id` 等任何欄位都會 400）。
 * - 高對比只存本機、永不上傳，也不接受伺服器值。
 * - 登入時伺服器值覆蓋本機（Web `setUserConfig` 合併順序）。
 *
 * 原生差異（見 port-ledger）：
 * - 語系：本機預設是「跟隨裝置」（`system`），伺服器永遠有值（預設 zh-TW），若照 Web 覆蓋會把英文裝置的
 *   使用者一登入就改成中文。因此只有使用者在 App 內明確選了語系才上傳，也不以伺服器值覆蓋本機。
 * - 通知：是否真的能收推播取決於這台裝置的系統權限，伺服器值不覆蓋本機；本機開關仍上傳（B-04 用）。
 * - `themeColor`：Web 沒有對應 UI、原生也不做主題色，不讀不寫。
 */

export type RemoteConfigPatch = Partial<Pick<UserConfig, 'language' | 'darkMode' | 'fontSize' | 'notifications' | 'memoryEnabled'>>;

export function toRemoteConfigPatch(patch: Partial<Preferences>): RemoteConfigPatch {
  const out: RemoteConfigPatch = {};
  if (patch.themeMode !== undefined) out.darkMode = patch.themeMode;
  if (patch.fontSize !== undefined) out.fontSize = patch.fontSize;
  if (patch.notifications !== undefined) out.notifications = patch.notifications;
  if (patch.memoryEnabled !== undefined) out.memoryEnabled = patch.memoryEnabled;
  if (patch.language !== undefined && patch.language !== 'system') out.language = patch.language;
  return out;
}

export function fromRemoteConfig(remote: Partial<UserConfig>): Partial<Preferences> {
  const out: Partial<Preferences> = {};
  if (remote.darkMode !== undefined) out.themeMode = remote.darkMode;
  if (remote.fontSize !== undefined) out.fontSize = remote.fontSize;
  if (remote.memoryEnabled !== undefined) out.memoryEnabled = remote.memoryEnabled;
  return out;
}
