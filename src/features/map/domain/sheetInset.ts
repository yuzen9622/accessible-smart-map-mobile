/**
 * 地圖常駐 sheet 的 detent（佔螢幕高度比例）。peek 只露出搜尋框；half 顯示清單；full 蓋住地圖。
 * 需與 app/_layout.tsx 的 formSheet `sheetAllowedDetents` 一致（兩處都從這裡讀）。
 */
export const SHEET_DETENTS = [0.15, 0.5, 1] as const;
export const SHEET_UNDIMMED_DETENT_INDEX = 1;

/**
 * 依 sheet 目前 detent 算出地圖底部 padding（pt）。
 * full 時地圖被蓋住，沿用 half 的 inset，避免相機在使用者看不到時亂跳。
 */
export function sheetBottomInset(detentIndex: number, windowHeight: number): number {
  const clampedIndex = Math.min(Math.max(detentIndex, 0), SHEET_UNDIMMED_DETENT_INDEX);
  const fraction = SHEET_DETENTS[clampedIndex] ?? SHEET_DETENTS[0];
  return Math.round(fraction * windowHeight);
}
