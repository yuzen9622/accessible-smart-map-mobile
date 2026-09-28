import { fetchRequest, type ApiResponse } from '@/shared/api';
import { getAppConfig } from '@/shared/config';

import type { AutocompleteItem, PlaceResult } from '../types/place';

/**
 * 移植自 Web `src/lib/api/placeSearch.ts`（commit 5eadc71）的
 * `getPlaceAutocomplete`／`getPlaceDetails`；`reverseGeocode` 另見 `reverseGeocode.ts`
 * （直接打 Nominatim，不經過本 App 後端，型別／關注點不同故分檔）。
 *
 * 差異：改用 `shared/api` 的 `fetchRequest`（base URL 來自 `getAppConfig().apiBaseUrl`，
 * 取代 Web 版 `END_POINT` 常數），並以 type guard 收窄回應的 `data` 形狀
 * （Web 版直接 `as ApiResponse<T>`，本 repo 禁 `any`／未經檢查的斷言）。
 */

function basePath(): string {
  return '/api/v1/a11y/search';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAutocompleteItem(value: unknown): value is AutocompleteItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    (value.source === 'osm' || value.source === 'google') &&
    typeof value.primaryText === 'string'
  );
}

function isAutocompleteItemArray(value: unknown): value is AutocompleteItem[] {
  return Array.isArray(value) && value.every(isAutocompleteItem);
}

function isPlaceResult(value: unknown): value is PlaceResult {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isRecord(value.location) &&
    Array.isArray((value.location as Record<string, unknown>).coordinates)
  );
}

export interface AutocompleteParams {
  q: string;
  sessiontoken?: string;
  lat?: number;
  lng?: number;
  sources?: string;
  limit?: number;
  lang?: string;
}

export async function getPlaceAutocomplete(
  params: AutocompleteParams,
  signal?: AbortSignal,
): Promise<ApiResponse<AutocompleteItem[]>> {
  const query = new URLSearchParams({ q: params.q });
  if (params.sessiontoken) query.set('sessiontoken', params.sessiontoken);
  if (params.lat !== undefined) query.set('lat', String(params.lat));
  if (params.lng !== undefined) query.set('lng', String(params.lng));
  if (params.sources) query.set('sources', params.sources);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.lang) query.set('lang', params.lang);

  const url = `${getAppConfig().apiBaseUrl}${basePath()}/autocomplete?${query.toString()}`;
  const response = await fetchRequest(url, signal ? { signal } : undefined);
  const data = isAutocompleteItemArray(response.data) ? response.data : undefined;
  return { ...response, data } as ApiResponse<AutocompleteItem[]>;
}

export interface PlaceDetailsParams {
  sessiontoken?: string;
  lat?: number;
  lng?: number;
  lang?: string;
}

/**
 * `id` 不得是 `coord:` 開頭（domain `isCoordPlaceId`）——後端 400。呼叫端
 * （`usePlaceDetail`）負責在呼叫前擋掉。
 */
export async function getPlaceDetails(
  id: string,
  params: PlaceDetailsParams,
  signal?: AbortSignal,
): Promise<ApiResponse<PlaceResult>> {
  const query = new URLSearchParams();
  if (params.sessiontoken) query.set('sessiontoken', params.sessiontoken);
  if (params.lat !== undefined) query.set('lat', String(params.lat));
  if (params.lng !== undefined) query.set('lng', String(params.lng));
  if (params.lang) query.set('lang', params.lang);

  const url = `${getAppConfig().apiBaseUrl}${basePath()}/details/${encodeURIComponent(id)}?${query.toString()}`;
  const response = await fetchRequest(url, signal ? { signal } : undefined);
  const data = isPlaceResult(response.data) ? response.data : undefined;
  return { ...response, data } as ApiResponse<PlaceResult>;
}
