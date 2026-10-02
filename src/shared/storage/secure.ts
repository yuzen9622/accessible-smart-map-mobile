import * as SecureStore from 'expo-secure-store';
import { logger } from '@/shared/logger';

/**
 * 憑證（access／refresh token）存 Keychain／Keystore。
 * 用 AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY：背景導航／SOS 任務在鎖屏時仍需 refresh；
 * THIS_DEVICE_ONLY 讓 token 不隨 iCloud 備份搬到其他裝置。
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export async function getSecureItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key, OPTIONS);
  } catch (error) {
    // 解密失敗（例如裝置還原、Keystore 金鑰失效）視為沒有值，讓使用者重新登入
    logger.warn(`[secure-store] read ${key} failed`, error);
    return null;
  }
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, OPTIONS);
}

export async function deleteSecureItem(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key, OPTIONS);
}
