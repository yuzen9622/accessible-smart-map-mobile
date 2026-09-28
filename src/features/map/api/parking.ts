import { fetchRequest } from '@/shared/api';
import type { LatLng } from '@/shared/geo';

import { parseParkingItems, type ParkingNearbyItem } from '../domain/parking';

// 移植自 Web src/lib/api/a11y.ts:216-221（getNearbyParking，commit 5eadc71）。
// 後端 query schema 為 Zod .strict()，不可多帶參數：只送 lat/lng，沒有 radius。
const PARKING_NEARBY_PATH = '/api/v1/a11y/parking/nearby';

export async function fetchNearbyParking(point: LatLng, signal?: AbortSignal): Promise<ParkingNearbyItem[]> {
  const response = await fetchRequest(`${PARKING_NEARBY_PATH}?lat=${point.lat}&lng=${point.lng}`, { signal });
  return parseParkingItems(response.data);
}
