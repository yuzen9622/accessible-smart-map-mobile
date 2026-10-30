import { fetchRequest } from '@/shared/api';

import type { NearbyA11yCategoryStat, NearbyA11ySummary, PlaceBounds } from '../types/place';

// 後端 `GET /a11y/nearby-a11y`：帶 bbox 時以地點範圍查詢，否則為座標 150 m 內。
const NEARBY_A11Y_PATH = '/api/v1/a11y/nearby-a11y';

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

/** 部署 summary 之前的後端不回這個欄位，此時回傳 null（清單維持「未確認」）。 */
export async function fetchNearbyA11ySummary(
  point: { lat: number; lng: number },
  bounds: PlaceBounds | null | undefined,
  signal?: AbortSignal,
): Promise<NearbyA11ySummary | null> {
  const query = new URLSearchParams({ lat: String(point.lat), lng: String(point.lng) });
  if (bounds) query.set('bbox', bounds.join(','));
  const response = await fetchRequest(`${NEARBY_A11Y_PATH}?${query.toString()}`, { signal });
  return isRecord(response.data) ? parseNearbyA11ySummary(response.data.summary) : null;
}
