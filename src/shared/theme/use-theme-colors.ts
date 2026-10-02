import { useColorScheme } from 'react-native';

import { usePreferencesStore } from '@/shared/preferences/preferencesStore';

import { type ThemeColors } from './colors';
import { resolveThemeColors } from './resolve-theme-colors';
import { semanticColors, type SemanticColors } from './tokens';

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

/** 語意色（accent／ok／warn／danger…），跟隨系統深淺色與使用者的高對比設定。 */
export function useSemanticColors(): SemanticColors {
  const scheme = useColorScheme();
  const highContrast = usePreferencesStore((s) => s.highContrast);
  return semanticColors(scheme === 'dark', highContrast);
}
