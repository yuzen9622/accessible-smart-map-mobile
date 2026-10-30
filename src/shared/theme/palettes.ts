/**
 * 領域色票（分類色）：交通方式、設施、功能識別。
 * 狀態色（ok／warn／danger）屬於 `tokens.ts` 的語意層，不在這裡。
 * `line` 用於地圖線與底板，`text` 是對白底 ≥ 4.5:1 的文字色。
 */
import { contrastRatio, hexToRgb } from './contrast';
import { ACCENT_FILL } from './tokens';

export interface DomainColor {
  line: string;
  text: string;
}

export const MODE = {
  walk: { line: '#007AFF', text: '#0066D6' },
  bus: { line: '#1B9A4B', text: '#1B7F3B' },
  metro: { line: '#0C8599', text: '#0B6577' },
  hsr: { line: '#E8590C', text: '#B34700' },
  tra: { line: '#1864AB', text: '#1864AB' },
  car: { line: '#475569', text: '#475569' },
  scooter: { line: '#C2255C', text: '#A61E4D' },
} as const satisfies Record<string, DomainColor>;

export type ModeKey = keyof typeof MODE;

/** 步行線的實色內線與亮色外框；綠色只表示已確認的人行道路徑。 */
export const WALK_ROUTE = {
  line: MODE.walk.line,
  casing: '#78B9FF',
  sidewalk: '#16844A',
  sidewalkCasing: '#83D4A7',
} as const;

export const FACILITY = {
  elevator: { line: '#1B7F3B', text: '#1B7F3B' },
  ramp: { line: '#C45A00', text: '#A64B00' },
  toilet: { line: '#6A1B9A', text: '#6A1B9A' },
  parking: { line: '#8A8E96', text: '#60646C' },
  cluster: { line: '#343A40', text: '#343A40' },
} as const satisfies Record<string, DomainColor>;

export type FacilityKey = keyof typeof FACILITY;

/** 功能識別：只用在圖示底板（白色圖示在 `line` 上），入口與內頁同色。 */
export const FEATURE = {
  ai: { line: '#7048E8', text: '#5B38C4' },
  bus: MODE.bus,
  rail: MODE.tra,
  report: { line: '#E8590C', text: '#B34700' },
  sos: { line: '#C62828', text: '#C02020' },
} as const satisfies Record<string, DomainColor>;

export type FeatureKey = keyof typeof FEATURE;

export const WHITE = '#FFFFFF';
export const BLACK = '#000000';

/** 地圖專用同色系外框；淺色線用深框，其餘用亮框。徽章與標記的字色另由原色票決定。 */
export function routeCasingColor(fill: string): string {
  const { r, g, b } = hexToRgb(fill);
  const pale = contrastRatio(fill, WHITE) < 3;
  const target = pale ? 0 : 255;
  const amount = pale ? 0.55 : 0.47;
  return '#' + [r, g, b]
    .map((channel) => Math.round(channel * (1 - amount) + target * amount).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}
/** 淺色線色（環狀線黃等）上的深色字與外框：白字對比不足時用它。 */
export const INK_DARK = '#1A1A1A';

/**
 * 捷運各線代表色，key 是後端 `MetroLeg.lineKey`。來源（2026-10-28）：zh.wikipedia Template:台北捷運色彩；
 * 三鶯、淡海、安坑取自 Module:Adjacent stations/新北捷運。不在表內的線沿用 `MODE.metro`。
 */
export const METRO_LINE_FILL: Readonly<Record<string, string>> = {
  TRTC_BR: '#C48C31',
  TRTC_R: '#E3002C',
  TRTC_G: '#008659',
  TRTC_O: '#F8B61C',
  TRTC_BL: '#0070BD',
  'TRTC_R_R-3': '#FD92A3',
  'TRTC_G_G-3': '#CFDB00',
  TRTCMG_MK: '#00AFE2',
  NTMC_Y: '#FFDB00',
  NTMC_LB: '#79BCE8',
  NTDLRT_V: '#E5554F',
  'NTDLRT_V_V-1': '#E5554F',
  'NTDLRT_V_V-2': '#E5554F',
  NTALRT_K: '#C3B091',
};

/** 線色上的文字／圖示色：白或 `INK_DARK`，取對比高者（也當淺色線在白底上的外框色）。 */
export const METRO_LINE_INK: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(METRO_LINE_FILL).map(([key, fill]) => [key, contrastRatio(WHITE, fill) >= contrastRatio(INK_DARK, fill) ? WHITE : INK_DARK]),
);
/** 地圖浮動元件與卡片的陰影色。 */

/** 無障礙評等（excellent → critical）。 */
export const A11Y_SCORE = {
  excellent: '#22c55e',
  good: '#84cc16',
  fair: '#eab308',
  poor: '#f97316',
  critical: '#ef4444',
} as const;

/** 路線上的無障礙特徵：障礙、穿越、坡道、升降、閘門。 */
export const ROUTE_FEATURE = {
  barrier: '#dc2626',
  crossing: '#f59e0b',
  ramp: '#16a34a',
  lift: '#2563eb',
  gate: '#7c3aed',
} as const;

export const TRAFFIC = {
  light: '#22C55E',
  moderate: '#F59E0B',
  heavy: '#EF4444',
  severe: '#991B1B',
  closed: '#4B5563',
  unknown: '#3B82F6',
  base: '#475569',
} as const;

/** 路線地圖上的起點、終點、途經點與事件標記。 */
export const ROUTE_MARKER = {
  origin: '#10B981',
  destination: '#EF4444',
  waypoint: '#3B82F6',
  closure: '#DC2626',
  advisory: '#F59E0B',
} as const;

/** 即時班次的小圓點。 */
export const LIVE_DOT = '#10B981';

/** 空氣品質分級（與後端 `classifyPm25` 的中文分級一一對應）。 */
export const AIR_QUALITY = {
  good: '#2B8A3E',
  moderate: '#E8A33D',
  sensitive: '#E8590C',
  unhealthy: '#C92A2A',
  veryUnhealthy: '#862E2E',
} as const;

export const SAVED_CATEGORY = {
  favorite: '#D6336C',
  food: '#E8590C',
  transport: '#0C8599',
  medical: '#E03131',
  other: '#495057',
} as const;

export const CUSTOM_CATEGORY = ['#7048E8', '#0F9960', '#C2255C', '#946200', '#1864AB', '#087F5B'] as const;

export const HAZARD = { obstacle: '#F59E0B', construction: '#F97316', dataError: '#DC2626' } as const;

/** 地圖圖層專用：描邊、標籤、圖示底色。 */
export const MAP = {
  stroke: WHITE,
  verifiedStroke: '#111111',
  label: '#0F172A',
  labelAlt: '#1C1C1E',
  busDefault: '#334155',
  busAccessible: '#2563EB',
  busPlainIcon: '#1F2937',
  aiPlace: '#7B3FE4',
  aiFacility: '#0065C8',
  pinBody: '#C62828',
  pinBorder: '#9F2020',
  pinCore: '#7F1818',
} as const;

/** 緊急按鈕按下後的深紅。 */
export const DANGER_DEEP = '#8E0000';
export const DESTRUCTIVE_TEXT = '#D92D20';

/** 語音聆聽光球的邊緣色（中心色取自主色）。 */
export const VOICE_ORB_EDGE = { light: '#A8CFF5', dark: '#1F4A7A' } as const;

export const SEGMENT_THUMB_DARK = '#636366';

/** 啟動畫面底色：與 App icon、`app.json` 的 splash 同為主色。 */
export const SPLASH_BG = ACCENT_FILL;
