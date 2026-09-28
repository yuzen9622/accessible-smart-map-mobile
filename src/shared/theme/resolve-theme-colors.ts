import { Colors, type ColorSchemeName, type ThemeColors } from './colors';

export interface ResolveThemeColorsOptions {
  scheme: ColorSchemeName;
  highContrast: boolean;
}

/**
 * 純函式版本：依系統色彩模式與是否啟用高對比，回傳對應色票。
 * 不讀任何 hook／全域狀態，方便單元測試與未來偏好設定 store 呼叫。
 */
export function resolveThemeColors({ scheme, highContrast }: ResolveThemeColorsOptions): ThemeColors {
  if (highContrast) {
    return scheme === 'dark' ? Colors['dark-hc'] : Colors['light-hc'];
  }
  return scheme === 'dark' ? Colors.dark : Colors.light;
}
