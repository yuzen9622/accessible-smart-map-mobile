import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { AccessibilityInfo, Alert, Linking } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { logger } from '@/shared/logger';

import { getLineLinkCode } from '../api/authApi';
import type { LineLinkCodeResult } from '../domain/types';
import { useAuthStore } from '../store/authStore';

/**
 * LINE 帳號綁定碼（對齊 Web `LineBindDialog.tsx`，commit f82cda8）：取得綁定碼後自動開 LINE 官方帳號，
 * 使用者把碼傳給機器人完成綁定。SDD §1.2：只保留「產生綁定碼」，不做 LIFF。
 */
export function useLineBind() {
  const { t } = useAppTranslation();
  const linked = Boolean(useAuthStore((s) => s.user?.lineUserId));
  const [info, setInfo] = useState<LineLinkCodeResult | null>(null);
  const [loading, setLoading] = useState(false);

  const openLine = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      logger.warn('[auth] open LINE failed', error);
    }
  };

  const bind = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await getLineLinkCode();
      if (!result) {
        Alert.alert(t('nativeLineCodeFailed'));
        return;
      }
      setInfo(result);
      AccessibilityInfo.announceForAccessibility(t('nativeLineCodeReady', { code: result.bindCode.toUpperCase() }));
      await openLine(result.bindUrl);
    } catch (error) {
      logger.warn('[auth] line link code failed', error);
      Alert.alert(t('nativeLineCodeFailed'));
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!info) return;
    try {
      await Clipboard.setStringAsync(info.bindCode.toUpperCase());
      AccessibilityInfo.announceForAccessibility(t('nativeCopied'));
    } catch {
      Alert.alert(t('copyFailed'));
    }
  };

  return {
    linked,
    info,
    code: info?.bindCode.toUpperCase() ?? null,
    loading,
    bind: () => void bind(),
    copy: () => void copy(),
    reopen: () => {
      if (info) void openLine(info.bindUrl);
    },
  };
}

export type LineBindModel = ReturnType<typeof useLineBind>;
