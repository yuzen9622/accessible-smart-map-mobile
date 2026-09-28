/**
 * 色票定義。`light-hc`／`dark-hc` 是高對比變體：
 * - `text` 對 `background` 對比 ≥ 7:1（WCAG AAA）
 * - `textSecondary` 對 `background` 同樣 ≥ 7:1（比 AAA 對次要文字的要求更嚴，簡化門檻判斷）
 * `light`／`dark` 一般變體維持 WCAG AA：`text`／`textSecondary` 對 `background` ≥ 4.5:1。
 * 門檻由 `contrast.test.ts` 以 `contrastRatio()` 實測驗證，不是憑肉眼挑色。
 */
export interface ThemeColors {
  text: string;
  textSecondary: string;
  background: string;
  backgroundElement: string;
}

export const Colors = {
  light: {
    text: '#000000',
    textSecondary: '#60646C',
    background: '#FFFFFF',
    backgroundElement: '#F0F0F3',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#B0B4BA',
    background: '#000000',
    backgroundElement: '#212225',
  },
  'light-hc': {
    text: '#000000',
    textSecondary: '#3C3F45',
    background: '#FFFFFF',
    backgroundElement: '#E5E5EA',
  },
  'dark-hc': {
    text: '#FFFFFF',
    textSecondary: '#D5D8DC',
    background: '#000000',
    backgroundElement: '#1C1C1E',
  },
} as const satisfies Record<'light' | 'dark' | 'light-hc' | 'dark-hc', ThemeColors>;

export type ThemeVariant = keyof typeof Colors;
export type ColorSchemeName = 'light' | 'dark';
