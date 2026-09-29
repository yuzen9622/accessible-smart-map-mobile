// 數值一律來自 `@/shared/theme` 的設計規範（tokens.ts），這裡只保留各 feature 既有的常數名稱。
import { ACCENT_FILL, ON_ACCENT_FILL, semanticColors } from '@/shared/theme';

/**
 * `@/shared/theme` 目前只提供 `text`／`textSecondary`／`background`／
 * `backgroundElement` 四個 token（見 `shared/theme/colors.ts`），沒有
 * 邊框色／強調色。跟 `features/map` 的 `ParkingLayer.tsx`（`PARKING_COLOR`
 * 常數）同樣做法：在 feature 內部固定幾個色值，不擴充 shared theme
 * （擴充共用 token 影響面大，超出本次 Phase 1.3 範圍）。
 */
/** White text on primary and small accent text on white both meet WCAG AA (5.68:1). */
export const PLACE_ACCENT_COLOR = ACCENT_FILL;
/** Accent text on dark surfaces must be lighter than the primary button fill. */
export const PLACE_ACCENT_COLOR_DARK = semanticColors(true).accent;
export const PLACE_BORDER_COLOR = 'rgba(120, 120, 128, 0.3)';

/** 兩個地圖常駐面板（Explore／PlaceDetail）的卡片、chip 與 tri-state 色票。
 * 顏色不是唯一狀態載體：tri-state 一律同時有 Lucide 形狀與文字。 */
export const PLACE_SURFACE_COLOR = semanticColors(false).neutral.bg;
export const PLACE_WARN_COLOR = semanticColors(false).warn.fg;
export const PLACE_WARN_SURFACE = semanticColors(false).warn.bg;
export const PLACE_OK_COLOR = semanticColors(false).ok.fg;
export const PLACE_OK_SURFACE = semanticColors(false).ok.bg;
export const PLACE_NO_COLOR = semanticColors(false).danger.fg;
export const PLACE_NO_SURFACE = semanticColors(false).danger.bg;
export const PLACE_ON_ACCENT_COLOR = ON_ACCENT_FILL;
/** 深色模式變體：上方 tri-state 色在黑底 12% 色塊上只有 3.2–3.6:1，換成這組 ≥ 6.8:1（WCAG AA） */
export const PLACE_WARN_COLOR_DARK = semanticColors(true).warn.fg;
export const PLACE_OK_COLOR_DARK = semanticColors(true).ok.fg;
export const PLACE_NO_COLOR_DARK = semanticColors(true).danger.fg;
