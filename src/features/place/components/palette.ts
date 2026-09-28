/**
 * `@/shared/theme` 目前只提供 `text`／`textSecondary`／`background`／
 * `backgroundElement` 四個 token（見 `shared/theme/colors.ts`），沒有
 * 邊框色／強調色。跟 `features/map` 的 `ParkingLayer.tsx`（`PARKING_COLOR`
 * 常數）同樣做法：在 feature 內部固定幾個色值，不擴充 shared theme
 * （擴充共用 token 影響面大，超出本次 Phase 1.3 範圍）。
 */
export const PLACE_ACCENT_COLOR = '#0A84FF';
export const PLACE_BORDER_COLOR = 'rgba(120, 120, 128, 0.3)';
