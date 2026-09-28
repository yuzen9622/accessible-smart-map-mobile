// 移植自 Web src/lib/geo.ts（5eadc71）的通用部分；路線相關 helper 在 Phase 2 移到 features/route/domain。
export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in meters between two LatLng points. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** GeoJSON 座標為 [lng, lat]；非有限數值時回傳 null。 */
export function lngLatToLatLng(coordinates: unknown): LatLng | null {
  if (!Array.isArray(coordinates)) return null;
  const [lng, lat] = coordinates;
  if (typeof lng !== 'number' || typeof lat !== 'number') return null;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return { lat, lng };
}
