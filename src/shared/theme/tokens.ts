/**
 * 設計規範（design tokens）——全 App 的色彩語意、字級、圓角、間距的唯一來源。
 *
 * 以前 route／place／bus 各有一份 `palette.ts`、表單又寫死 `#1565C0`，同一個「主色」有四種藍、
 * 「危險」有五種紅，字級有 13 種、圓角有 10 種。這裡把它們收斂成一組，各 feature 的 palette 只轉出這裡的值。
 *
 * 取值原則：
 * - 主色沿用各面板已在用、且實測對比達標的 `#0065C8`（白字 5.68:1）；深色模式用較亮的 `#6BB2FF`。
 * - 語意色（ok／warn／danger）一律「文字色＋12% 底色」成對使用，顏色不是唯一狀態載體（還要有圖示與文字）。
 * - 字級只有 7 階，對齊 iOS Dynamic Type 的相對關係；呼叫端仍以 `scaledSize` 套使用者字級倍率。
 */

export interface ToneColors {
  /** 文字／圖示色。 */
  fg: string;
  /** 淡底色（chip、提示卡）。 */
  bg: string;
}

export interface SemanticColors {
  /** 主色「文字／圖示」色。深色模式是亮藍，**不可**當實心按鈕底色（實心底一律用 `ACCENT_FILL`）。 */
  accent: string;
  /** 主色淡底（選中的 chip、目前步驟）。 */
  accentSoft: string;
  ok: ToneColors;
  warn: ToneColors;
  danger: ToneColors;
  /** 中性：未確認、已過站、次要標籤——不帶情緒，不搶戲。 */
  neutral: ToneColors;
  /** 卡片、輸入框的底（疊在 sheet 背景上）。 */
  surface: string;
  /** 分隔線、外框。 */
  separator: string;
}

const LIGHT: SemanticColors = {
  accent: '#0065C8',
  accentSoft: 'rgba(0,101,200,0.12)',
  ok: { fg: '#1B7F3B', bg: 'rgba(52,199,89,0.12)' },
  warn: { fg: '#B25000', bg: 'rgba(255,149,0,0.12)' },
  danger: { fg: '#C02020', bg: 'rgba(255,59,48,0.12)' },
  neutral: { fg: '#60646C', bg: 'rgba(120,120,128,0.12)' },
  surface: 'rgba(120,120,128,0.10)',
  separator: 'rgba(60,60,67,0.18)',
};

const DARK: SemanticColors = {
  accent: '#6BB2FF',
  accentSoft: 'rgba(107,178,255,0.18)',
  ok: { fg: '#4CD471', bg: 'rgba(52,199,89,0.16)' },
  warn: { fg: '#FF9F2E', bg: 'rgba(255,149,0,0.16)' },
  danger: { fg: '#FF6961', bg: 'rgba(255,59,48,0.16)' },
  neutral: { fg: '#B0B4BA', bg: 'rgba(120,120,128,0.24)' },
  surface: 'rgba(120,120,128,0.20)',
  separator: 'rgba(84,84,88,0.6)',
};

/**
 * 高對比變體：語意前景色對 `background`／`backgroundElement` ≥ 7:1（`contrast.test.ts` 實測），
 * 底色沿用一般變體的淡色調。
 */
const LIGHT_HC: SemanticColors = {
  ...LIGHT,
  accent: '#003D7A',
  ok: { ...LIGHT.ok, fg: '#084D21' },
  warn: { ...LIGHT.warn, fg: '#6E3000' },
  danger: { ...LIGHT.danger, fg: '#8A0C0C' },
  neutral: { ...LIGHT.neutral, fg: '#3C3F45' },
  separator: 'rgba(60,60,67,0.45)',
};

const DARK_HC: SemanticColors = {
  ...DARK,
  accent: '#9CCBFF',
  ok: { ...DARK.ok, fg: '#7EE69B' },
  warn: { ...DARK.warn, fg: '#FFC173' },
  danger: { ...DARK.danger, fg: '#FFA19B' },
  neutral: { ...DARK.neutral, fg: '#D5D8DC' },
  separator: 'rgba(235,235,245,0.45)',
};

/** 元件內請優先用 `useSemanticColors()`（會跟隨高對比設定）；這個純函式給模組常數與測試用。 */
export function semanticColors(isDark: boolean, highContrast = false): SemanticColors {
  if (highContrast) return isDark ? DARK_HC : LIGHT_HC;
  return isDark ? DARK : LIGHT;
}

/** 淺色主色：實心按鈕底色在兩種模式都用它（深色模式的 `accent` 是給文字用的亮藍）。 */
export const ACCENT_FILL = '#0065C8';
export const ON_ACCENT_FILL = '#FFFFFF';
/** 緊急／危險實心按鈕（SOS、結束導航）。 */
export const DANGER_FILL = '#C62828';

/** 字級（pt，未乘使用者倍率）。 */
export const TYPE = {
  /** 大標：地點名、路線總時間。 */
  title: 24,
  /** 區塊大標：面板標題。 */
  headline: 20,
  /** 卡片標題、列表主文字。 */
  body: 16,
  /** 次要內文。 */
  callout: 15,
  /** 輔助說明、距離、時間。 */
  subhead: 13,
  /** chip、badge。 */
  caption: 12,
  /** 導航 HUD 的距離數字。 */
  display: 30,
} as const;

/**
 * 使用者字級倍率上限（RN `maxFontSizeMultiplier`），分層而不是一刀鎖死：
 * 本來就大的標題少放大，內文多放大。iOS 最大輔助字級約 3.1 倍，標題放到 3 倍會吃掉半個 sheet。
 * 小字至少 2 倍（WCAG 1.4.4 要求文字可放大到 200%），否則低視能使用者在最大字級看到的反而是全畫面最小的字。
 */
export const MAX_FONT_SCALE = {
  /** 地點名、區塊標題（24／20pt 起跳）。 */
  heading: 1.5,
  /** chip、badge、按鈕、距離、計數這類短標籤。 */
  label: 2,
  /** 地址、列表主文字、評價內文（會換行，給得比標籤寬）。 */
  body: 2.5,
} as const;

/** 圓角：卡片 16、按鈕與 chip 用膠囊（高度的一半）、小元件 10。 */
export const RADIUS = {
  small: 10,
  card: 16,
  pill: 999,
} as const;

/** 間距：4 的倍數。 */
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

/** 觸控目標下限（iOS 44pt／Android 48dp；SDD §10）。 */
export const MIN_TOUCH = 44;
/** 主要按鈕高度。 */
export const BUTTON_HEIGHT = 50;
