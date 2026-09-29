import { useEffect } from 'react';
import { Appearance } from 'react-native';

import { useDeviceLanguageSync } from '@/shared/i18n';

import { usePreferencesStore } from './preferencesStore';

/**
 * 把偏好套到整個 App：主題以 `Appearance.setColorScheme` 覆寫（原生元件、formSheet、SwiftUI 都會跟著換），
 * 語系以使用者指定優先、否則跟隨裝置。在根 layout 呼叫一次。
 */
export function usePreferencesEffects(): void {
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const language = usePreferencesStore((s) => s.language);

  useEffect(() => {
    Appearance.setColorScheme(themeMode === 'system' ? 'unspecified' : themeMode);
  }, [themeMode]);

  useDeviceLanguageSync(language === 'system' ? null : language);
}
