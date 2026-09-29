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

/** 地點／設施詳情的路由前綴：點到地點時 sheet 只開到 half，讓使用者看得到自己點的位置。 */
const PLACE_DETAIL_PREFIXES = ['/loc/', '/place/', '/facility/'] as const;

export function isPlaceDetailPath(pathname: string): boolean {
  return PLACE_DETAIL_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export interface SheetConfig {
  detents: number[];
  initialDetentIndex: number;
}

/**
 * 依情境決定 sheet 可用 detent 與落點：
 * - 導航中：peek／half（full 會蓋住 HUD）。
 * - 地點詳情：peek／half 並直接落在 half（不給 full，地圖上的點才看得到）。
 * - 其他：peek／half／full，落在 peek。
 * 換 allowed detents 時原生 sheet 會重新落在 `initialDetentIndex`，且不會發 sheetDetentChange。
 */
export function sheetConfig(isNavigating: boolean, pathname: string): SheetConfig {
  if (isNavigating) return { detents: SHEET_DETENTS.slice(0, SHEET_UNDIMMED_DETENT_INDEX + 1), initialDetentIndex: 0 };
  if (isPlaceDetailPath(pathname)) {
    return { detents: SHEET_DETENTS.slice(0, SHEET_UNDIMMED_DETENT_INDEX + 1), initialDetentIndex: SHEET_UNDIMMED_DETENT_INDEX };
  }
  return { detents: [...SHEET_DETENTS], initialDetentIndex: 0 };
}
