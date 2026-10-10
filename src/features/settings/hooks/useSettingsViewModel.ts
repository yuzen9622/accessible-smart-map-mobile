import Constants from 'expo-constants';
import { router } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { useRef } from 'react';
import { AccessibilityInfo, Alert, Linking, Platform } from 'react-native';

import { runAccountDeletion, selectIsLoggedIn, signOut, useAuthStore } from '@/features/auth';
import { requestPushPermission, syncPushToken, usePushStatus } from '@/features/notifications';
import { useOnboardingStore } from '@/features/onboarding';
import { getAppConfig } from '@/shared/config';
import { useAppTranslation } from '@/shared/i18n';
import { logger } from '@/shared/logger';
import {
  usePreferencesStore,
  type FontSizeLevel,
  type LanguagePreference,
  type ThemeMode,
} from '@/shared/preferences';

export interface Choice<T extends string> {
  value: T;
  label: string;
}

/**
 * 設定首頁 view-model。項目對齊 Web 設定對話框五個分頁（commit f82cda8）：外觀、緊急安全、帳號安全、
 * AI 記憶、資料管理；原生把它們攤平成一個清單，子頁以 push 進入（SDD §6.11）。
 */
export function useSettingsViewModel() {
  const { t } = useAppTranslation();
  const loggedIn = useAuthStore(selectIsLoggedIn);
  const user = useAuthStore((s) => s.user);
  const prefs = usePreferencesStore();
  const pushStatus = usePushStatus((s) => s.status);
  const notificationAttempt = useRef(0);
  const situations = useOnboardingStore((s) => s.profile.situations);

  const requireLogin = (action: () => void) => () => {
    if (loggedIn) action();
    else router.navigate('/auth');
  };

  const confirmLogout = () => {
    Alert.alert(t('logout'), t('nativeLogoutConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('logout'),
        style: 'destructive',
        onPress: () => {
          signOut();
          AccessibilityInfo.announceForAccessibility(t('nativeLoggedOut'));
        },
      },
    ]);
  };

  const runDelete = async (password?: string) => {
    try {
      const outcome = await runAccountDeletion({ password });
      switch (outcome) {
        case 'deleted':
          Alert.alert(t('nativeDeleteAccountDone'));
          return;
        case 'cancelled':
          return;
        case 'needsPassword':
          askPassword(password !== undefined);
          return;
        case 'wrongAccount':
          Alert.alert(t('nativeDeleteAccountWrongAccount'));
          return;
        case 'appleAuthorizationInvalid':
          Alert.alert(t('nativeDeleteAccountAppleInvalid'));
          return;
        case 'appleUnavailable':
          Alert.alert(t('nativeDeleteAccountAppleUnavailable'));
          return;
        default:
          Alert.alert(t('nativeDeleteAccountFailed'));
      }
    } catch (error) {
      logger.warn('[settings] delete account failed', error);
      Alert.alert(t('nativeDeleteAccountFailed'));
    }
  };

  // 後端要求「5 分鐘內登入」才能刪：密碼帳號需要再輸入一次密碼。Alert.prompt 只有 iOS；Android 請使用者重新登入。
  const askPassword = (retry: boolean) => {
    if (Platform.OS !== 'ios') {
      Alert.alert(t('nativeDeleteAccountReauth'));
      return;
    }
    Alert.prompt(
      t('nativeDeleteAccountPasswordTitle'),
      retry ? t('nativeDeleteAccountPasswordWrong') : t('nativeDeleteAccountPasswordBody'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('nativeDeleteAccountConfirm'), style: 'destructive', onPress: (value?: string) => void runDelete(value?.trim() || undefined) },
      ],
      'secure-text',
    );
  };

  const confirmDelete = () => {
    Alert.alert(t('nativeDeleteAccountTitle'), t('nativeDeleteAccountBody'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('nativeDeleteAccountConfirm'), style: 'destructive', onPress: () => void runDelete() },
    ]);
  };

  const setNotifications = (enabled: boolean) => {
    const attempt = ++notificationAttempt.current;
    const session = useAuthStore.getState().session;
    if (!enabled) {
      prefs.setPreferences({ notifications: false });
      void syncPushToken();
      return;
    }
    const run = async () => {
      try {
        const status = await requestPushPermission();
        if (attempt !== notificationAttempt.current || useAuthStore.getState().session !== session) return;
        if (status !== 'granted') {
          usePushStatus.setState({ status });
          prefs.setPreferences({ notifications: false });
          Alert.alert(t('notificationBlocked'), undefined, [
            { text: t('cancel'), style: 'cancel' },
            { text: t('nativeOpenSettings'), onPress: () => void Linking.openSettings() },
          ]);
          return;
        }
        prefs.setPreferences({ notifications: true });
        await syncPushToken();
      } catch {
        if (attempt !== notificationAttempt.current || useAuthStore.getState().session !== session) return;
        usePushStatus.setState({ status: 'tokenError' });
      }
    };
    void run();
  };
  const notificationStatus = !loggedIn && prefs.notifications && pushStatus !== 'unregisterError'
    ? 'signedOut' : pushStatus;
  const notificationAction = notificationStatus === 'denied' ? () => void Linking.openSettings()
    : notificationStatus === 'signedOut' ? () => router.navigate('/auth')
    : notificationStatus === 'undetermined' ? () => setNotifications(true)
    : ['tokenError', 'registrationError', 'unregisterError'].includes(notificationStatus) ? () => void syncPushToken() : null;

  const themeChoices: Choice<ThemeMode>[] = [
    { value: 'system', label: t('nativeThemeSystem') },
    { value: 'light', label: t('nativeThemeLight') },
    { value: 'dark', label: t('nativeThemeDark') },
  ];
  const fontChoices: Choice<FontSizeLevel>[] = [
    { value: 'small', label: t('nativeFontSmall') },
    { value: 'medium', label: t('nativeFontMedium') },
    { value: 'large', label: t('nativeFontLarge') },
    { value: 'mega', label: t('nativeFontMega') },
  ];
  const languageChoices: Choice<LanguagePreference>[] = [
    { value: 'system', label: t('nativeLanguageSystem') },
    { value: 'zh-TW', label: '中文' },
    { value: 'en', label: 'English' },
  ];

  return {
    account: loggedIn && user
      ? {
          name: user.name,
          email: user.email,
          lineLinked: Boolean(user.lineUserId),
          hasPassword: user.authProviders.includes('local'),
        }
      : null,
    openLogin: () => router.navigate('/auth'),
    openSecurity: () => router.navigate('/settings/security'),
    openLine: () => router.navigate('/settings/line'),
    logout: confirmLogout,
    deleteAccount: confirmDelete,

    themeMode: prefs.themeMode,
    themeChoices,
    setThemeMode: (value: ThemeMode) => prefs.setPreferences({ themeMode: value }),
    highContrast: prefs.highContrast,
    setHighContrast: (value: boolean) => prefs.setPreferences({ highContrast: value }),
    fontSize: prefs.fontSize,
    fontChoices,
    setFontSize: (value: FontSizeLevel) => prefs.setPreferences({ fontSize: value }),
    language: prefs.language,
    languageChoices,
    setLanguage: (value: LanguagePreference) => prefs.setPreferences({ language: value }),
    notifications: prefs.notifications,
    setNotifications,
    notificationStatusText: t(`nativePushStatus_${notificationStatus}`),
    notificationAction,
    notificationActionLabel: t(notificationStatus === 'denied' ? 'nativeOpenSettings' : notificationStatus === 'signedOut' ? 'loginRegisterCta' : 'retry'),
    memoryEnabled: prefs.memoryEnabled,

    needsSummary:
      situations.length > 0
        ? situations.map((s) => t(`onboarding.situation.${s}`)).join('、')
        : t('nativeNeedsNone'),
    openNeeds: () => router.navigate('/settings/needs'),
    openContacts: requireLogin(() => router.navigate('/settings/contacts')),
    openMemory: () => router.navigate('/settings/memory'),
    openReports: requireLogin(() => router.navigate('/settings/reports')),
    openData: () => router.navigate('/settings/data'),
    // 清掉完成旗標後，地圖主畫面（`app/index.tsx`）的 effect 會自動開 onboarding。
    resetGuides: () => useOnboardingStore.getState().resetGuides(),
    version: Constants.expoConfig?.version ?? '',
    legalLinks: legalLinks(t),
  };
}

export interface LegalLink {
  key: 'privacy' | 'terms';
  label: string;
  open: () => void;
}

/** 隱私權政策／服務條款（商店審查要求 App 內可查看）；網址未設定就不顯示該項。 */
function legalLinks(t: (key: string) => string): LegalLink[] {
  const { privacyPolicyUrl, termsUrl } = getAppConfig();
  const open = (url: string) => async () => {
    try {
      await openBrowserAsync(url);
    } catch (error) {
      logger.warn('[settings] open legal link failed', error);
    }
  };
  const links: LegalLink[] = [];
  if (privacyPolicyUrl) links.push({ key: 'privacy', label: t('nativePrivacyPolicy'), open: open(privacyPolicyUrl) });
  if (termsUrl) links.push({ key: 'terms', label: t('nativeTermsOfService'), open: open(termsUrl) });
  return links;
}

export type SettingsViewModel = ReturnType<typeof useSettingsViewModel>;
