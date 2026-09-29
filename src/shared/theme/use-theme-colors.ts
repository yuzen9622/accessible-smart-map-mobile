import { useColorScheme } from 'react-native';

import { usePreferencesStore } from '@/shared/preferences/preferencesStore';

import { type ThemeColors } from './colors';
import { resolveThemeColors } from './resolve-theme-colors';

export interface UseThemeColorsOptions {
  /**
   * 是否套用高對比色票；省略時跟隨使用者設定（`shared/preferences` 的 `highContrast`）。
   */
  highContrast?: boolean;
}

export function useThemeColors(options?: UseThemeColorsOptions): ThemeColors {
  const scheme = useColorScheme();
  const preferHighContrast = usePreferencesStore((s) => s.highContrast);
  return resolveThemeColors({
    scheme: scheme === 'dark' ? 'dark' : 'light',
    highContrast: options?.highContrast ?? preferHighContrast,
  });
}
