import { fetchRequest } from '@/shared/api';
import { getAppLanguage, type AppLanguage } from '@/shared/i18n';
import { logger } from '@/shared/logger';
import { appStorage, readJson } from '@/shared/storage';

import { parseFacilities, type Facility } from '../domain/facilities';

// 只有這三類有地圖 pin；伺服器端過濾讓 payload 從約 5 MB 降到約 1.1 MB（Web a11y.ts:26-33）
const FACILITIES_PATH = '/api/v1/a11y/all-facilities?category=elevator,ramp,toilet';
const CACHE_KEY = 'cache.facilities.v1';
export const FACILITIES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface FacilityCache {
  savedAt: number;
  items: unknown[];
}

function isFacilityCache(value: unknown): value is FacilityCache {
  return (
    typeof value === 'object' &&
    value !== null &&
    'savedAt' in value &&
    typeof value.savedAt === 'number' &&
    'items' in value &&
    Array.isArray(value.items)
  );
}

export function readCachedFacilities(now = Date.now(), lang: AppLanguage = getAppLanguage()): { facilities: Facility[]; fresh: boolean } | null {
  const cache = readJson<FacilityCache | null>(appStorage, `${CACHE_KEY}.${lang}`, isFacilityCache, null);
  if (!cache) return null;
  return { facilities: parseFacilities(cache.items), fresh: now - cache.savedAt < FACILITIES_CACHE_TTL_MS };
}

export async function fetchFacilities(signal?: AbortSignal, lang: AppLanguage = getAppLanguage()): Promise<Facility[]> {
  const response = await fetchRequest(`${FACILITIES_PATH}&lang=${lang}`, { signal });
  const items = Array.isArray(response.data) ? response.data : [];
  try {
    const cache: FacilityCache = { savedAt: Date.now(), items };
    if (!signal?.aborted) appStorage.set(`${CACHE_KEY}.${lang}`, JSON.stringify(cache));
  } catch (error) {
    logger.warn('[facilities] cache write failed', error);
  }
  return parseFacilities(items);
}
