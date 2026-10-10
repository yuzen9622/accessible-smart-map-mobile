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
import { logger } from '@/shared/logger';

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

/** Read the active UI language at request time, including user overrides. */
export function getAppLanguage(): AppLanguage {
  return i18n.resolvedLanguage === 'en' || i18n.language === 'en' ? 'en' : 'zh-TW';
}

/**
 * 跟隨裝置語系；`override` 為使用者在設定中指定的語系（`shared/preferences`），有值時優先。
 * Android 可在 App 執行中改語系，useLocales 會重新 render。
 */
export function useDeviceLanguageSync(override: AppLanguage | null = null): void {
  const locales = useLocales();
  const language = override ?? resolveDeviceLanguage(locales);
  useEffect(() => {
    const sync = async () => {
      try {
        await changeAppLanguage(language);
      } catch (error) {
        logger.warn('[i18n] changeLanguage failed', error);
      }
    };
    void sync();
  }, [language]);
}

export function useAppTranslation() {
  return useTranslation();
}

export default i18n;
