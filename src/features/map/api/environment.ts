import { fetchRequest } from '@/shared/api';
import type { LatLng } from '@/shared/geo';

import { parseEnvironment, type EnvironmentInfo } from '../domain/environment';

// 天氣（CWA）＋空氣品質（環境部 PM2.5）聚合查詢；金鑰只放後端環境變數，不進 App bundle
// （測試人員回饋 2026-10-11：CWA 金鑰不能塞進 client）。
const ENVIRONMENT_PATH = '/api/v1/a11y/environment';

export async function fetchEnvironment(point: LatLng, signal?: AbortSignal): Promise<EnvironmentInfo> {
  const response = await fetchRequest(`${ENVIRONMENT_PATH}?lat=${point.lat}&lng=${point.lng}`, { signal });
  return parseEnvironment(response.data);
}
