import type { PlaceResult } from '../types/place';

export type ChecklistAvailability = boolean | null;

export interface ChecklistItem {
  key: 'wheelchair' | 'elevator' | 'ramp' | 'toilet';
  available: ChecklistAvailability;
}

/**
 * 簡化自 Web `PlaceContent.tsx:276-339`（commit 5eadc71）的 `a11yChecklist`。
 *
 * **必守不變量**（brief 不變量清單 #1）：elevator/ramp/toilet 只能是
 * `true`／`null`，永遠不能是 `false`——後端無法區分「已調查、確認沒有」和
 * 「從未調查」，顯示確定的 ✗ 會誤導輪椅使用者以為某處確定不可通行。
 *
 * **與 Web 版的差異**（記錄於 port-ledger）：Web 版還會合併附近廁所／捷運
 * 無障礙設施（`getNearbyRouteA11yPlaces`）與 OSM 地點細節
 * （`getOsmPlaceDetail` 的 `wheelchair`／`tags`／`facilities`）兩個資料源，
 * 屬於 `features/map`（SDD §6.1 a11y 設施）的職責範圍，不在 Phase 1.3
 * （`features/place`）之內。本版只用 place-detail 端點自帶的
 * `place.accessibility.wheelchair`；elevator/ramp/toilet 三項因缺少那兩個
 * 資料源，目前只能回傳 `null`（未確認）——仍然滿足「絕不顯示確定 false」
 * 的不變量，只是可用的確定 `true` 訊號比 Web 版少。等 a11y 設施資料接進
 * 地圖 feature 後，可以把該資料源注入這個函式（多一個參數）補上真訊號。
 */
export function buildAccessibilityChecklist(place: PlaceResult): ChecklistItem[] {
  const wheelchair = place.accessibility.wheelchair;
  const wheelchairAvailable: ChecklistAvailability = wheelchair === 'yes' || wheelchair === 'limited' ? true : wheelchair === 'no' ? false : null;

  return [
    { key: 'wheelchair', available: wheelchairAvailable },
    { key: 'elevator', available: null },
    { key: 'ramp', available: null },
    { key: 'toilet', available: null },
  ];
}
