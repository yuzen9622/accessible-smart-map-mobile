import { formatNominatimPlace } from '../domain/formatNominatimPlace';
import type { NominatimAddress, NominatimPlace } from '../types/place';

/**
 * 移植自 Web `src/lib/api/placeSearch.ts` 的 `reverseGeocode`（commit 5eadc71）。
 * 直接打 Nominatim（不經過本 App 後端），保留同樣的記憶體快取
 * （TTL 5 分鐘、上限 200 筆、對滿即淘汰最舊一筆）與自訂 header。
 *
 * 差異（見 port-ledger）：
 * - 回傳前與 Web 一樣經 `formatNominatimPlace`（domain/formatNominatimPlace.ts）整理地名與地址。
 * - `structuredClone` 在部分 Hermes 版本上的可用性未核實，快取的深拷貝改用
 *   `JSON.parse(JSON.stringify(...))`（Nominatim payload 只有 JSON 安全值，
 *   無 Date／函式等不可序列化欄位，等價且更保守）。
 * - RN `fetch` 不像瀏覽器會擋 `User-Agent`，故不需要 Web 版的 try/catch
 *   降級，但仍照 Nominatim 使用政策一併送出 `Referer`。
 */

export interface ReverseGeocodeParams {
  lat: number;
  lng: number;
  lang?: string;
  zoom?: number;
  addressdetails?: number;
  signal?: AbortSignal;
}

interface ReverseCacheEntry {
  place: NominatimPlace;
  timestamp: number;
}

const REVERSE_CACHE_TTL_MS = 5 * 60 * 1000;
const REVERSE_CACHE_MAX_ENTRIES = 200;
const reverseGeocodeCache = new Map<string, ReverseCacheEntry>();

export function clearReverseGeocodeCache(): void {
  reverseGeocodeCache.clear();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNominatimAddress(value: unknown): value is NominatimAddress {
  return value === undefined || isRecord(value);
}

function isNominatimPlace(value: unknown): value is NominatimPlace {
  if (!isRecord(value)) return false;
  return typeof value.lat === 'string' && typeof value.lon === 'string' && typeof value.display_name === 'string' && isNominatimAddress(value.address);
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class ReverseGeocodeError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ReverseGeocodeError';
    this.status = status;
  }
}

/**
 * 反查地址；非合法座標或 Nominatim 回傳錯誤信封時回傳 `null`，
 * HTTP 非 2xx 時丟 `ReverseGeocodeError`。
 */
export async function reverseGeocode(params: ReverseGeocodeParams): Promise<NominatimPlace | null> {
  const { lat, lng, signal } = params;
  const lang = params.lang ?? 'zh-TW';
  const zoom = params.zoom ?? 18;
  const addressdetails = params.addressdetails ?? 1;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)},${lang},${zoom},${addressdetails}`;
  const now = Date.now();
  const cached = reverseGeocodeCache.get(cacheKey);
  if (cached && now - cached.timestamp < REVERSE_CACHE_TTL_MS) {
    return deepClone(cached.place);
  }

  const query = new URLSearchParams({
    format: 'json',
    lat: String(lat),
    lon: String(lng),
    'accept-language': lang,
    zoom: String(zoom),
    addressdetails: String(addressdetails),
  });
  const url = `https://nominatim.openstreetmap.org/reverse?${query.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept-Language': lang,
      // Nominatim 使用政策要求可辨識的 User-Agent／Referer，見
      // https://operations.osmfoundation.org/policies/nominatim/
      'User-Agent': 'AccessibleSmartMap/1.0 (https://map.yuzen.dev)',
      Referer: 'https://map.yuzen.dev',
    },
    signal,
  });

  if (!response.ok) {
    throw new ReverseGeocodeError(`Reverse geocoding failed with status ${response.status}`, response.status);
  }

  const raw: unknown = await response.json();
  if (!isRecord(raw) || typeof raw.error === 'string') {
    return null;
  }
  if (!isNominatimPlace(raw)) {
    return null;
  }

  if (reverseGeocodeCache.size >= REVERSE_CACHE_MAX_ENTRIES) {
    const oldestKey = reverseGeocodeCache.keys().next().value;
    if (oldestKey !== undefined) reverseGeocodeCache.delete(oldestKey);
  }
  // 對齊 Web：把 Nominatim 的 display_name 整理成乾淨的地名與地址（例如「臺北市中正區黎明里北平西路3號」）
  const formatted = formatNominatimPlace(raw, lang);
  reverseGeocodeCache.set(cacheKey, { place: deepClone(formatted), timestamp: now });

  return formatted;
}
