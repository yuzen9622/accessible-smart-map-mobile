/**
 * App 層級的字級倍率，疊加在系統 Dynamic Type 之上（不是取代）。
 * `scaledSize` 回傳的值仍要放進 RN `Text` 的 `fontSize`，並保持該元件
 * `allowFontScaling`（預設 true）不被關閉，系統字級縮放才會繼續生效。
 */
export function scaledSize(base: number, appScale: number): number {
  return base * appScale;
}
