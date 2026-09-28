/**
 * 移植自 Web `src/lib/place/searchSession.ts`（commit 5eadc71，逐行搬移）。
 * Google-Places 風格的「一次搜尋 session 一個 token」模式：自動完成與最終
 * 選定的 `getPlaceDetails` 共用同一個 token，選定後（或查詢清空後）換新。
 */
export function createSearchSessionToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
