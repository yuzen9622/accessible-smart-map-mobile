/** bus feature 內部色票（`@/shared/theme` 只有四個 token；同 place／map 的做法在 feature 內固定）。 */
export const BUS_ACCENT_COLOR = '#0065C8';
export const BUS_ACCENT_COLOR_DARK = '#6BB2FF';
export const BUS_ON_ACCENT_COLOR = '#FFFFFF';
export const BUS_BORDER_COLOR = 'rgba(120, 120, 128, 0.3)';
export const BUS_SURFACE_COLOR = 'rgba(120,120,128,0.12)';
export const BUS_SELECTED_SURFACE = 'rgba(0,101,200,0.14)';

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
