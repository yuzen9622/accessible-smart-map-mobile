/**
 * 地圖常駐 sheet 的 detent（佔螢幕高度比例）。peek 只露出搜尋框；half 顯示清單；full 蓋住地圖。
 * 需與 app/_layout.tsx 的 formSheet `sheetAllowedDetents` 一致（兩處都從這裡讀）。
 */
export const SHEET_DETENTS = [0.15, 0.5, 1] as const;
export const SHEET_UNDIMMED_DETENT_INDEX = 1;
/**
 * 導航中的 peek：只露出收合列（剩餘時間＋語音／2D3D／結束），步驟清單要往上滑才出現（對齊 Google Maps）。
 * 比一般 peek 低；地圖 inset 仍沿用 `SHEET_DETENTS[0]`，多留一點底部 padding 無妨。
 */
export const NAV_PEEK_DETENT = 0.115;

/**
 * 依 sheet 目前 detent 算出地圖底部 padding（pt）。
 * full 時地圖被蓋住，沿用 half 的 inset，避免相機在使用者看不到時亂跳。
 */
export function sheetBottomInset(detentIndex: number, windowHeight: number): number {
  const clampedIndex = Math.min(Math.max(detentIndex, 0), SHEET_UNDIMMED_DETENT_INDEX);
  const fraction = SHEET_DETENTS[clampedIndex] ?? SHEET_DETENTS[0];
  return Math.round(fraction * windowHeight);
}

/** 地點／設施詳情的路由前綴：點到地點時 sheet 落在 half，讓使用者看得到自己點的位置。 */
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
 * - 導航中：較低的 peek（只露出收合列）／half（full 會蓋住 HUD）。
 * - 地點詳情：peek／half／full，落在 half（先看得到自己點的位置，但仍可往上拉）。
 * - 其他：peek／half／full，落在 peek。
 * 換 allowed detents 時原生 sheet 會重新落在 `initialDetentIndex`，且不會發 sheetDetentChange。
 *
 * 地點詳情過去不給 full（只有 peek／half 兩檔），但那會讓 sheet 停在「已是最大 detent」的狀態——
 * iOS `UISheetPresentationController` 在最大 detent 時才會把往上拖曳的手勢交給內容的
 * `ScrollView` 接手；只有兩檔時使用者會卡在「拖不動 sheet、也滑不動內容」。保留 full 選項
 * 讓手勢交接正常運作，使用者一樣可以把 sheet 拉到底看完整段內容。
 */
export function sheetConfig(isNavigating: boolean, pathname: string): SheetConfig {
  if (isNavigating) return { detents: [NAV_PEEK_DETENT, SHEET_DETENTS[SHEET_UNDIMMED_DETENT_INDEX]], initialDetentIndex: 0 };
  if (isPlaceDetailPath(pathname)) {
    return { detents: [...SHEET_DETENTS], initialDetentIndex: SHEET_UNDIMMED_DETENT_INDEX };
  }
  return { detents: [...SHEET_DETENTS], initialDetentIndex: 0 };
}
