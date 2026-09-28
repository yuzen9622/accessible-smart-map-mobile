import type { LatLng } from '@/shared/geo';

export const LAST_USER_LOCATION_KEY = 'lastUserLocation';
export const DEFAULT_CENTER: LatLng = { lat: 25.0478, lng: 121.517 };
export const DEFAULT_ZOOM = 15;
export const LOCATED_ZOOM = 17;

export function isLatLng(value: unknown): value is LatLng {
  return (
    typeof value === 'object' &&
    value !== null &&
    'lat' in value &&
    'lng' in value &&
    typeof value.lat === 'number' &&
    typeof value.lng === 'number' &&
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng)
  );
}

/** 對齊 Web ClientMap.tsx 的 initialCenter：有上次位置就用它（zoom 17），否則預設台北（zoom 15）。 */
export function resolveInitialCamera(lastLocation: LatLng | null): { center: LatLng; zoom: number } {
  return lastLocation
    ? { center: lastLocation, zoom: LOCATED_ZOOM }
    : { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
}
