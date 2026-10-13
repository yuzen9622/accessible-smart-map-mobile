import { Alert } from 'react-native';

import { usePreferencesStore } from '@/shared/preferences';

import { openLegalDocument } from './legal';

type Translate = (key: string) => string;

/**
 * 使用會把個資交給第三方 AI（Google Gemini／Cloud Vision）的功能前，先揭露並取得明確同意
 * （App Store 5.1.2(i)）。已同意就直接放行；否則每次由使用者主動觸發 AI 功能時再問一次，
 * 不同意只擋下這個動作，App 其他功能照常可用。同意可在設定頁撤回（`aiDataConsent`）。
 */
export function ensureAiDataConsent(t: Translate): Promise<boolean> {
  if (usePreferencesStore.getState().aiDataConsent) return Promise.resolve(true);
  return requestAiDataConsent(t);
}

/** 不論目前狀態都顯示揭露內容；設定頁打開開關時也走這裡，確保同意前一定看過說明。 */
export function requestAiDataConsent(t: Translate): Promise<boolean> {
  return new Promise((resolve) => {
    const decide = (granted: boolean) => {
      usePreferencesStore.getState().setPreferences({ aiDataConsent: granted });
      resolve(granted);
    };
    Alert.alert(
      t('aiConsent.title'),
      t('aiConsent.body'),
      [
        { text: t('aiConsent.decline'), style: 'cancel', onPress: () => decide(false) },
        {
          text: t('aiConsent.privacyPolicy'),
          onPress: () => {
            resolve(false);
            void openLegalDocument('privacy');
          },
        },
        { text: t('aiConsent.accept'), onPress: () => decide(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
