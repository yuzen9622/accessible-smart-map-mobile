// 數值一律來自 `@/shared/theme` 的設計規範（tokens.ts），這裡只保留各 feature 既有的常數名稱。
import { ON_ACCENT_FILL } from '@/shared/theme';

/** bus feature 內部色票（`@/shared/theme` 只有四個 token；同 place／map 的做法在 feature 內固定）。 */
export const BUS_ON_ACCENT_COLOR = ON_ACCENT_FILL;
export const BUS_BORDER_COLOR = 'rgba(120, 120, 128, 0.3)';

export type PillTone = 'arriving' | 'ok' | 'normal' | 'muted';

interface ToneStyle {
  color: string;
  surface: string;
}

const LIGHT: Record<PillTone, ToneStyle> = {
  arriving: { color: '#C02020', surface: 'rgba(255,59,48,0.12)' },
  ok: { color: '#1B7F3B', surface: 'rgba(52,199,89,0.12)' },
  normal: { color: '#60646C', surface: 'rgba(120,120,128,0.12)' },
  muted: { color: '#60646C', surface: 'rgba(120,120,128,0.08)' },
};
const DARK: Record<PillTone, ToneStyle> = {
  arriving: { color: '#FF6961', surface: 'rgba(255,59,48,0.16)' },
  ok: { color: '#4CD471', surface: 'rgba(52,199,89,0.16)' },
  normal: { color: '#B0B4BA', surface: 'rgba(120,120,128,0.2)' },
  muted: { color: '#B0B4BA', surface: 'rgba(120,120,128,0.14)' },
};

export function pillToneStyle(tone: PillTone, isDark: boolean): ToneStyle {
  return (isDark ? DARK : LIGHT)[tone];
}
