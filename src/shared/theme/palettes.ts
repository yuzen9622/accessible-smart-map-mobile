/**
 * 領域色票（分類色）：交通方式、設施、功能識別。
 * 狀態色（ok／warn／danger）屬於 `tokens.ts` 的語意層，不在這裡。
 * `line` 用於地圖線與底板，`text` 是對白底 ≥ 4.5:1 的文字色。
 */
export interface DomainColor {
  line: string;
  text: string;
}

export const MODE = {
  walk: { line: '#8A8E96', text: '#60646C' },
  bus: { line: '#1B9A4B', text: '#1B7F3B' },
  metro: { line: '#0C8599', text: '#0B6577' },
  hsr: { line: '#E8590C', text: '#B34700' },
  tra: { line: '#1864AB', text: '#1864AB' },
  car: { line: '#475569', text: '#475569' },
  scooter: { line: '#C2255C', text: '#A61E4D' },
} as const satisfies Record<string, DomainColor>;

export type ModeKey = keyof typeof MODE;

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
