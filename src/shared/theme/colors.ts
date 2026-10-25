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
  /** 比 `backgroundElement` 再高一階：按鈕、輸入框這類疊在卡片／sheet 上面的可互動控制項
   * （使用者回饋 2026-10-25：深色模式三層都太接近，缺乏 elevation／surface depth）。 */
  backgroundElevated: string;
  /** `backgroundElevated` 控制項的細邊框，讓浮動按鈕的邊界在深色模式也看得出來。 */
  elevatedBorder: string;
}

export const Colors = {
  light: {
    text: '#000000',
    textSecondary: '#60646C',
    background: '#FFFFFF',
    backgroundElement: '#F0F0F3',
    // 淺色模式「拉高」是更白：疊在 backgroundElement 上的控制項用純白區隔出來。
    backgroundElevated: '#FFFFFF',
    elevatedBorder: 'rgba(0,0,0,0.08)',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#B0B4BA',
    background: '#000000',
    // 比純黑 `background` 明顯拉開一階（原 #212225 太接近黑，膠囊／搜尋框／卡片在
    // sheet 上幾乎融成一片，邊界難辨——使用者回饋 2026-10-24 錄影：深色模式太黑沒層次）。
    backgroundElement: '#2C2C2E',
    // 再往上一階給按鈕／輸入框：跟 Apple HIG 深色模式的三層背景同一個漸層邏輯
    // （systemBackground → secondarySystemBackground → tertiarySystemBackground）。
    backgroundElevated: '#3A3A3C',
    elevatedBorder: 'rgba(255,255,255,0.1)',
  },
  'light-hc': {
    text: '#000000',
    textSecondary: '#3C3F45',
    background: '#FFFFFF',
    backgroundElement: '#E5E5EA',
    backgroundElevated: '#FFFFFF',
    elevatedBorder: 'rgba(0,0,0,0.15)',
  },
  'dark-hc': {
    text: '#FFFFFF',
    textSecondary: '#D5D8DC',
    background: '#000000',
    backgroundElement: '#1C1C1E',
    backgroundElevated: '#2C2C2E',
    elevatedBorder: 'rgba(255,255,255,0.18)',
  },
} as const satisfies Record<'light' | 'dark' | 'light-hc' | 'dark-hc', ThemeColors>;

export type ThemeVariant = keyof typeof Colors;
export type ColorSchemeName = 'light' | 'dark';
