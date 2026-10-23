// 數值一律來自 `@/shared/theme` 的設計規範（tokens.ts），這裡只保留各 feature 既有的常數名稱。
import { ON_ACCENT_FILL, semanticColors } from '@/shared/theme';

/** bus feature 內部色票（`@/shared/theme` 只有四個 token；同 place／map 的做法在 feature 內固定）。 */
export const BUS_ON_ACCENT_COLOR = ON_ACCENT_FILL;
export const BUS_BORDER_COLOR = 'rgba(120, 120, 128, 0.3)';

export type PillTone = 'arriving' | 'ok' | 'normal' | 'muted';

interface ToneStyle {
  color: string;
  surface: string;
}

function toneStyles(isDark: boolean): Record<PillTone, ToneStyle> {
  const { danger, ok, neutral } = semanticColors(isDark);
  return {
    arriving: { color: danger.fg, surface: danger.bg },
    ok: { color: ok.fg, surface: ok.bg },
    normal: { color: neutral.fg, surface: neutral.bg },
    muted: { color: neutral.fg, surface: isDark ? 'rgba(120,120,128,0.14)' : 'rgba(120,120,128,0.08)' },
  };
}

export function pillToneStyle(tone: PillTone, isDark: boolean): ToneStyle {
  return toneStyles(isDark)[tone];
}
