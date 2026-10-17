import { fetchRequest } from '@/shared/api';
import type { LatLng } from '@/shared/geo';
import { getAppLanguage, type AppLanguage } from '@/shared/i18n';

import { parseParkingItems, type ParkingNearbyItem } from '../domain/parking';

// 移植自 Web src/lib/api/a11y.ts:216-221（getNearbyParking，commit 5eadc71）。
// 後端 query schema 為 Zod .strict()：送 lat/lng 與名稱語系 lang，沒有 radius。
const PARKING_NEARBY_PATH = '/api/v1/a11y/parking/nearby';

export async function fetchNearbyParking(point: LatLng, signal?: AbortSignal, lang: AppLanguage = getAppLanguage()): Promise<ParkingNearbyItem[]> {
  const response = await fetchRequest(`${PARKING_NEARBY_PATH}?lat=${point.lat}&lng=${point.lng}&lang=${lang}`, { signal });
  return parseParkingItems(response.data);
}
