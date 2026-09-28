import { useColorScheme } from 'react-native';

import { type ThemeColors } from './colors';
import { resolveThemeColors } from './resolve-theme-colors';

export interface UseThemeColorsOptions {
  /**
   * 是否套用高對比色票。之後由偏好設定 store 提供實際值；目前預設 false。
   */
  highContrast?: boolean;
}

export function useThemeColors(options?: UseThemeColorsOptions): ThemeColors {
  const scheme = useColorScheme();
  return resolveThemeColors({
    scheme: scheme === 'dark' ? 'dark' : 'light',
    highContrast: options?.highContrast ?? false,
  });
}
