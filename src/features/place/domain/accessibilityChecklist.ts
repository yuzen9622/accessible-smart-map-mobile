import type { NearbyA11yCategoryStat, NearbyA11ySummary, PlaceResult } from '../types/place';

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
 * elevator/ramp/toilet 來自後端 `nearby-a11y` 的分類彙整 `summary`（地點範圍內
 * 各類別的數量），各類別獨立判斷：有數量才是 `true`，否則 `null`。沒有 summary
 * （載入中、失敗、舊後端）時三項都是 `null`。
 *
 * **與 Web 版的差異**（記錄於 port-ledger）：Web 版另外合併 OSM 地點細節
 * （`getOsmPlaceDetail` 的 `tags`／`facilities`），本版尚未接這個資料源。
 */
export function buildAccessibilityChecklist(place: PlaceResult, summary: NearbyA11ySummary | null = null): ChecklistItem[] {
  const wheelchair = place.accessibility.wheelchair;
  const wheelchairAvailable: ChecklistAvailability = wheelchair === 'yes' || wheelchair === 'limited' ? true : wheelchair === 'no' ? false : null;
  const present = (stat: NearbyA11yCategoryStat | undefined): ChecklistAvailability => (stat && stat.count > 0 ? true : null);

  return [
    { key: 'wheelchair', available: wheelchairAvailable },
    { key: 'elevator', available: present(summary?.elevator) },
    { key: 'ramp', available: present(summary?.ramp) },
    { key: 'toilet', available: present(summary?.toilet) },
  ];
}
