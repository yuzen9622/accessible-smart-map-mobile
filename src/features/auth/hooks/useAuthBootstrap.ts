import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';

import { restoreSession, useAuthStore } from '../store/authStore';

/**
 * 在根 layout 呼叫一次：冷啟動讀回 SecureStore 的 session 並靜默續期；伺服器拒絕續期時提示「登入已過期」。
 * 提示只在 session 結算為空時出現（主動登出、身分已被替換時保持安靜，對齊 Web fetch.ts 的 round7-F1）。
 */
export function useAuthBootstrap(): void {
  const { t } = useAppTranslation();
  const sessionExpired = useAuthStore((s) => s.sessionExpired);

  useEffect(() => {
    const run = async () => {
      try {
        await restoreSession();
      } catch (error) {
        console.warn('[auth] restore session failed', error);
      }
    };
    void run();
  }, []);

  useEffect(() => {
    if (!sessionExpired) return;
    useAuthStore.getState().clearExpiredNotice();
    Alert.alert(t('nativeSessionExpiredTitle'), t('nativeSessionExpiredBody'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('auth.login'), onPress: () => router.push('/auth') },
    ]);
  }, [sessionExpired, t]);
}
