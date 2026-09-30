import { useState } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { useCloseScreen } from '@/shared/navigation';

import { changePassword } from '../api/authApi';
import { validatePassword } from '../domain/passwordValidation';
import { useAuthStore } from '../store/authStore';

/**
 * 帳號安全：變更密碼，或 Google／Apple 帳號新增密碼登入方式。對齊 Web `AccountSecurityPanel.tsx`（commit f82cda8）。
 * 成功後後端撤銷所有舊 session 並換發新 token，必須以回應的新 token 取代，否則下一個請求就會 403 被登出。
 */
export function useChangePassword() {
  const { t } = useAppTranslation();
  const closeScreen = useCloseScreen();
  const user = useAuthStore((s) => s.user);
  const hasPassword = user?.authProviders.includes('local') ?? false;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (message: string) => {
    setError(message);
    AccessibilityInfo.announceForAccessibility(message);
  };

  const submit = async () => {
    if (loading) return;
    setError(null);
    const code = validatePassword(newPassword);
    if (code) {
      fail(t(`nativeAuthPassword_${code}`));
      return;
    }
    if (hasPassword && !currentPassword) {
      fail(t('nativeSecurityCurrentRequired'));
      return;
    }
    setLoading(true);
    try {
      const result = await changePassword(newPassword, hasPassword ? currentPassword : undefined);
      switch (result.kind) {
        case 'ok':
          useAuthStore.getState().setSession({ accessToken: result.accessToken, refreshToken: result.refreshToken });
          useAuthStore.getState().setUser(result.user);
          Alert.alert(hasPassword ? t('nativeSecurityUpdated') : t('nativeSecurityAdded'));
          closeScreen();
          break;
        case 'wrongCurrentPassword':
          fail(t('nativeSecurityWrongCurrent'));
          break;
        case 'currentPasswordRequired':
          fail(t('nativeSecurityCurrentRequired'));
          break;
        default:
          fail(result.message || t('nativeSecurityFailed'));
      }
    } catch (err) {
      console.warn('[auth] change password failed', err);
      fail(t('nativeNetworkError'));
    } finally {
      setLoading(false);
    }
  };

  return {
    hasPassword,
    title: hasPassword ? t('nativeSecurityChangeTitle') : t('nativeSecurityAddTitle'),
    description: hasPassword ? t('nativeSecurityChangeDesc') : t('nativeSecurityAddDesc'),
    submitLabel: hasPassword ? t('nativeSecurityChangeSubmit') : t('nativeSecurityAddSubmit'),
    currentPassword,
    newPassword,
    setCurrentPassword,
    setNewPassword,
    loading,
    error,
    submit: () => void submit(),
  };
}

export type ChangePasswordModel = ReturnType<typeof useChangePassword>;
