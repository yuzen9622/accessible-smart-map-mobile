// 移植自 Web src/types/route.ts:931-940（formatDistance，commit 5eadc71），四捨五入規則逐條對齊。
// Phase 1 原放在 features/map/domain/parking.ts；Phase 2 路線、導航也要用，所以提到共用層。

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '';
  // >=100km: whole km, a decimal place is false precision at that range.
  if (meters >= 100_000) return `${Math.round(meters / 1000)} km`;
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  // Below 10m the round-to-10 rule renders a real 4m step as "0 m", which
  // reads as no movement at all — the CSR engine emits plenty of these.
  if (meters < 10) return `${Math.round(meters)} m`;
  // Round to the nearest 10m — "583 m" implies GPS accuracy this app
  // doesn't have; "580 m" reads as the estimate it actually is.
  return `${Math.round(meters / 10) * 10} m`;
}
