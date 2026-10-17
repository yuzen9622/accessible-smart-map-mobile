import { openBrowserAsync } from 'expo-web-browser';
import { Linking } from 'react-native';

import { getAppConfig } from '@/shared/config';
import { getAppLanguage, type AppLanguage } from '@/shared/i18n';
import { logger } from '@/shared/logger';

export type LegalDocument = 'privacy' | 'terms';

/** 正式網站上的政策頁（Web 版 `/[locale]/policies/*`）；`/privacy`、`/terms` 這類短網址是 404，不要用。 */
const LEGAL_SITE = 'https://map.yuzen.dev';
const LEGAL_PATH: Record<LegalDocument, string> = {
  privacy: 'privacy-policy',
  terms: 'terms-of-use',
};

/** 客服信箱，與隱私權政策頁公開的聯絡方式一致（App Store 1.2：使用者發表內容的 App 要公開聯絡方式）。 */
export const SUPPORT_EMAIL = 'nutcaiedlab@gmail.com';

/**
 * 政策頁網址。EXPO_PUBLIC_* 有設定就用設定值，否則用正式網站依語系的頁面——商店審查要求 App 內一定找得到
 * 隱私權政策（5.1.1(i)），所以不能因為環境變數漏設就整個入口消失。
 */
export function legalDocumentUrl(document: LegalDocument, language: AppLanguage = getAppLanguage()): string {
  const config = getAppConfig();
  const override = document === 'privacy' ? config.privacyPolicyUrl : config.termsUrl;
  return override ?? `${LEGAL_SITE}/${language}/policies/${LEGAL_PATH[document]}`;
}

export async function openLegalDocument(document: LegalDocument): Promise<void> {
  try {
    await openBrowserAsync(legalDocumentUrl(document));
  } catch (error) {
    logger.warn('[privacy] open legal document failed', error);
  }
}

export async function openSupportEmail(): Promise<void> {
  try {
    await Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  } catch (error) {
    logger.warn('[privacy] open support email failed', error);
  }
}
