import { fetchRequest } from '@/shared/api';

import type { NearbyA11yCategoryStat, NearbyA11ySummary, PlaceBounds } from '../types/place';

// 有地點範圍時以 bbox 查詢；地圖點擊、OSM 等沒有範圍的地點只是一個點，由後端查詢點周圍的固定半徑。
const NEARBY_A11Y_PATH = '/api/v1/a11y/nearby-a11y';

export function isValidPlaceBounds(bounds: PlaceBounds | null | undefined): bounds is PlaceBounds {
  if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite)) return false;
  const [west, south, east, north] = bounds;
  return west >= -180 && east <= 180 && south >= -90 && north <= 90 && west < east && south < north;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseStat(value: unknown): NearbyA11yCategoryStat | null {
  if (!isRecord(value) || typeof value.count !== 'number' || !Number.isFinite(value.count)) return null;
  const nearest = value.nearestMeters;
  return { count: value.count, nearestMeters: typeof nearest === 'number' && Number.isFinite(nearest) ? nearest : null };
}

export function parseNearbyA11ySummary(value: unknown): NearbyA11ySummary | null {
  if (!isRecord(value)) return null;
  const elevator = parseStat(value.elevator);
  const ramp = parseStat(value.ramp);
  const toilet = parseStat(value.toilet);
  return elevator && ramp && toilet ? { elevator, ramp, toilet } : null;
}

export interface NearbyA11yData {
  summary: NearbyA11ySummary | null;
  nearbyBathroom: unknown[];
  nearbyMetroA11y: unknown[];
}

/** 列表與摘要共用同一個查詢；舊回應缺少摘要時仍保留設施列表。 */
export async function fetchNearbyA11y({
  point,
  bounds,
  lang,
  signal,
}: {
  point: { lat: number; lng: number };
  bounds?: PlaceBounds | null;
  lang?: string;
  signal?: AbortSignal;
}): Promise<NearbyA11yData> {
  const query = new URLSearchParams({ lat: String(point.lat), lng: String(point.lng) });
  if (isValidPlaceBounds(bounds)) query.set('bbox', bounds.join(','));
  if (lang) query.set('lang', lang);
  const response = await fetchRequest(`${NEARBY_A11Y_PATH}?${query.toString()}`, { signal });
  const data = response.data;
  if (!isRecord(data) || Array.isArray(data)) {
    throw new Error('Invalid nearby accessibility facilities response');
  }
  return {
    summary: parseNearbyA11ySummary(data.summary),
    nearbyBathroom: Array.isArray(data.nearbyBathroom) ? data.nearbyBathroom : [],
    nearbyMetroA11y: Array.isArray(data.nearbyMetroA11y) ? data.nearbyMetroA11y : [],
  };
}
