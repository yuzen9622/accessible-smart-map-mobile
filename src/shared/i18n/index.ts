import { getLocales, useLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { useEffect } from 'react';
import { initReactI18next, useTranslation } from 'react-i18next';

import en from './locale/en/translation.json';
import zhTW from './locale/zh-TW/translation.json';
import {
  FALLBACK_LANGUAGE,
  SUPPORTED_LANGUAGES,
  resolveDeviceLanguage,
  type AppLanguage,
} from './language';

export {
  FALLBACK_LANGUAGE,
  SUPPORTED_LANGUAGES,
  isAppLanguage,
  resolveDeviceLanguage,
  type AppLanguage,
  type DeviceLocale,
} from './language';

const i18n = createInstance();

// initAsync: false → resources 已內嵌，init 同步完成，第一個 render 就有翻譯
void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    'zh-TW': { translation: zhTW },
  },
  lng: resolveDeviceLanguage(getLocales()),
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: { escapeValue: false },
  initAsync: false,
});

export async function changeAppLanguage(language: AppLanguage): Promise<void> {
  if (i18n.language === language) return;
  await i18n.changeLanguage(language);
}

/**
 * 跟隨裝置語系。Android 可在 App 執行中改語系，useLocales 會重新 render。
 * TODO(settings)：使用者在 App 內指定語系後，以使用者設定優先（Phase 3 settings）。
 */
export function useDeviceLanguageSync(): void {
  const locales = useLocales();
  const language = resolveDeviceLanguage(locales);
  useEffect(() => {
    const sync = async () => {
      try {
        await changeAppLanguage(language);
      } catch (error) {
        console.warn('[i18n] changeLanguage failed', error);
      }
    };
    void sync();
  }, [language]);
}

export function useAppTranslation() {
  return useTranslation();
}

export default i18n;
