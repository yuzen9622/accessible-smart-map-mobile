import { fetchRequest, type ApiResponse } from '@/shared/api';
import { getAppConfig } from '@/shared/config';
import type { LatLng } from '@/shared/geo';

import type {
  BusArrivalData,
  BusArrivalItem,
  BusSearchResult,
  BusStopSearchResult,
  LiveBus,
  LiveBusPositionsData,
  RouteDetailDirection,
  RouteDetailStop,
  StopArrival,
  StopArrivalsData,
} from '../types/transit';

/**
 * 移植自 Web `src/lib/api/transit.ts`（commit 5eadc71）中本 App 用得到的端點：
 * arrival、positions、route-detail、search-routes、search-stops、nearby-stops（皆 PUBLIC）。
 *
 * 差異：
 * - 改用 `shared/api` 與 `getAppConfig().apiBaseUrl`。
 * - Web 每支都自己 `setTimeout(10s) → abort`，而且只有成功路徑會 `clearTimeout`（fetch 丟錯時計時器
 *   會殘留到觸發）。本版統一用 `withTimeout`：同時接受呼叫端的 AbortSignal（輪詢換 leg 時取消），
 *   並在 `finally` 清掉計時器。
 * - 回應逐欄組出（見下方 parser）：外層形狀不對時 `data` 為 undefined；單筆壞資料丟掉；選填欄位給預設值。
 * - Web 還有 `POST /transit/bus`、`/transit/bus/realtime`、`/transit/train`（Google Directions 時代的
 *   舊端點，Web 目前無人呼叫）與 `/transit/alerts`（Web 沒有直接呼叫，警示夾在路線回應裡），都不搬。
 */

const TIMEOUT_MS = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDirection(value: unknown): value is 0 | 1 {
  return value === 0 || value === 1;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringOr(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

// 以下 parser 都逐欄組出物件：必要欄位不對就丟掉那一筆，選填欄位型別不對就當作沒給、
// 文字預設空字串、數字預設 null——不把沒驗證過的欄位原樣帶進 App。

function parseRouteDetailStop(value: unknown): RouteDetailStop | null {
  if (!isRecord(value)) return null;
  const { seq, name, lat, lng } = value;
  if (typeof seq !== 'number' || typeof name !== 'string') return null;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { seq, name, lat, lng, estimateMinutes: finiteOrNull(value.estimateMinutes), statusLabel: stringOr(value.statusLabel) };
}

function parseRouteDetail(value: unknown): { directions: RouteDetailDirection[] } | undefined {
  if (!isRecord(value) || !Array.isArray(value.directions)) return undefined;
  const directions: RouteDetailDirection[] = [];
  for (const d of value.directions) {
    if (!isRecord(d) || !isDirection(d.direction) || !Array.isArray(d.stops)) continue;
    const stops = d.stops.map(parseRouteDetailStop);
    // 站序缺一站就無法切出正確的乘車區間：整個方向丟掉，比少一站更安全。
    if (stops.some((stop) => stop === null)) continue;
    directions.push({
      direction: d.direction,
      stops: stops.filter((stop): stop is RouteDetailStop => stop !== null),
      subRouteUid: optionalString(d.subRouteUid),
      subRouteName: optionalString(d.subRouteName),
    });
  }
  return { directions };
}

function parseArrivalItem(value: unknown): BusArrivalItem | null {
  if (!isRecord(value) || typeof value.stopName !== 'string' || !isDirection(value.direction)) return null;
  return {
    stopName: value.stopName,
    direction: value.direction,
    directionLabel: stringOr(value.directionLabel),
    estimateMinutes: finiteOrNull(value.estimateMinutes),
    statusLabel: stringOr(value.statusLabel),
    plateNumb: optionalString(value.plateNumb),
    subRouteUid: optionalString(value.subRouteUid),
    subRouteName: optionalString(value.subRouteName),
  };
}

function parseArrival(value: unknown): BusArrivalData | undefined {
  if (!isRecord(value) || !Array.isArray(value.arrivals)) return undefined;
  return {
    routeName: stringOr(value.routeName),
    city: stringOr(value.city),
    stopName: stringOr(value.stopName),
    arrivals: value.arrivals.map(parseArrivalItem).filter((a): a is BusArrivalItem => a !== null),
  };
}

function parseLiveBus(value: unknown): LiveBus | null {
  if (!isRecord(value) || typeof value.plateNumb !== 'string') return null;
  // 方向不明的車不能判斷是不是往使用者那邊開（SDD §6.5）：丟掉，不捏造一個方向。
  const direction = finiteOrNull(value.direction);
  if (direction === null) return null;
  const { lat, lng } = value;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    plateNumb: value.plateNumb,
    direction,
    directionLabel: optionalString(value.directionLabel),
    lat,
    lng,
    speed: finiteOrNull(value.speed) ?? 0,
    statusLabel: optionalString(value.statusLabel),
    gpsTime: stringOr(value.gpsTime),
    isLowFloor: stringOr(value.isLowFloor),
    hasLiftOrRamp: stringOr(value.hasLiftOrRamp),
    vehicleClass: stringOr(value.vehicleClass),
    routeName: optionalString(value.routeName),
    city: optionalString(value.city),
    stopsAway: finiteOrNull(value.stopsAway) ?? undefined,
    subRouteUid: optionalString(value.subRouteUid),
    subRouteName: optionalString(value.subRouteName),
  };
}

function parsePositions(value: unknown): LiveBusPositionsData | undefined {
  if (!isRecord(value) || !Array.isArray(value.buses)) return undefined;
  const buses = value.buses.map(parseLiveBus).filter((b): b is LiveBus => b !== null);
  return {
    routeName: stringOr(value.routeName),
    city: stringOr(value.city),
    count: finiteOrNull(value.count) ?? buses.length,
    lowFloorCount: finiteOrNull(value.lowFloorCount) ?? 0,
    buses,
  };
}

function parseRouteSearch(value: unknown): { routes: BusSearchResult[] } | undefined {
  if (!isRecord(value) || !Array.isArray(value.routes)) return undefined;
  const routes: BusSearchResult[] = [];
  for (const r of value.routes) {
    if (!isRecord(r) || typeof r.routeName !== 'string' || typeof r.city !== 'string') continue;
    routes.push({ routeName: r.routeName, city: r.city, departure: stringOr(r.departure), destination: stringOr(r.destination) });
  }
  return { routes };
}

function parseStopList(value: unknown): { stops: BusStopSearchResult[] } | undefined {
  if (!isRecord(value) || !Array.isArray(value.stops)) return undefined;
  const stops: BusStopSearchResult[] = [];
  for (const s of value.stops) {
    if (!isRecord(s) || typeof s.stopName !== 'string' || !Array.isArray(s.coordinates)) continue;
    const [lng, lat] = s.coordinates;
    if (typeof lng !== 'number' || typeof lat !== 'number' || !Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    stops.push({
      stopUid: stringOr(s.stopUid),
      stopName: s.stopName,
      city: stringOr(s.city),
      coordinates: [lng, lat],
      routes: Array.isArray(s.routes) ? s.routes.filter((r): r is string => typeof r === 'string') : [],
      distance: finiteOrNull(s.distance) ?? undefined,
    });
  }
  return { stops };
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function parseStopArrival(value: unknown): StopArrival | null {
  if (!isRecord(value) || typeof value.routeName !== 'string' || !isDirection(value.direction)) return null;
  return {
    routeName: value.routeName,
    subRouteUid: optionalString(value.subRouteUid),
    subRouteName: optionalString(value.subRouteName),
    direction: value.direction,
    headsign: typeof value.headsign === 'string' && value.headsign ? value.headsign : null,
    estimateMinutes: finiteOrNull(value.estimateMinutes),
    statusLabel: stringOr(value.statusLabel),
    plateNumb: optionalString(value.plateNumb),
    isLowFloor: booleanOrNull(value.isLowFloor),
    hasLiftOrRamp: booleanOrNull(value.hasLiftOrRamp),
  };
}

function parseStopArrivals(value: unknown): StopArrivalsData | undefined {
  if (!isRecord(value) || !Array.isArray(value.arrivals)) return undefined;
  return {
    stopName: stringOr(value.stopName),
    city: stringOr(value.city),
    arrivals: value.arrivals.map(parseStopArrival).filter((a): a is StopArrival => a !== null),
  };
}

function narrow<T>(response: ApiResponse<unknown>, parse: (value: unknown) => T | undefined): ApiResponse<T> {
  const data: T | undefined = parse(response.data);
  return { ...response, data };
}

/** 10 秒逾時＋呼叫端取消，兩者任一觸發就 abort；計時器一定會清掉。 */
async function withTimeout(path: string, signal: AbortSignal | undefined): Promise<ApiResponse<unknown>> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', onAbort);
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetchRequest(`${getAppConfig().apiBaseUrl}${path}`, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function locationParam(params: URLSearchParams, location?: LatLng | null): void {
  if (location && Number.isFinite(location.lat) && Number.isFinite(location.lng)) {
    params.set('location', `${location.lat},${location.lng}`);
  }
}

export async function getBusArrival(
  query: { routeName?: string; stopName?: string; direction?: 0 | 1; city?: string },
  signal?: AbortSignal,
): Promise<ApiResponse<BusArrivalData>> {
  const params = new URLSearchParams();
  if (query.routeName) params.set('routeName', query.routeName);
  if (query.stopName) params.set('stopName', query.stopName);
  if (query.direction !== undefined) params.set('direction', String(query.direction));
  if (query.city) params.set('city', query.city);
  return narrow(await withTimeout(`/api/v1/transit/bus/arrival?${params.toString()}`, signal), parseArrival);
}

/**
 * 一個站牌所有行經路線的下一班（後端一次 TDX 呼叫＋20 秒共用快取）。
 * 站牌畫面只能用這支：逐路線打 route-detail／positions 會在大站牌上耗光共用的 TDX 額度。
 */
export async function getStopArrivals(
  query: { stopName: string; city: string; position: LatLng },
  signal?: AbortSignal,
): Promise<ApiResponse<StopArrivalsData>> {
  const params = new URLSearchParams({
    stopName: query.stopName,
    city: query.city,
    lat: String(query.position.lat),
    lng: String(query.position.lng),
  });
  return narrow(await withTimeout(`/api/v1/transit/bus/stop-arrivals?${params.toString()}`, signal), parseStopArrivals);
}

/** 一條路線（可限定方向）所有車輛的即時位置；後端已正規化成 camelCase／lat,lng。 */
export async function getLiveBusPositions(
  query: { routeName: string; city?: string; direction?: 0 | 1 },
  signal?: AbortSignal,
): Promise<ApiResponse<LiveBusPositionsData>> {
  const params = new URLSearchParams({ routeName: query.routeName });
  if (query.city) params.set('city', query.city);
  if (query.direction !== undefined) params.set('direction', String(query.direction));
  return narrow(await withTimeout(`/api/v1/transit/bus/positions?${params.toString()}`, signal), parsePositions);
}

export async function getBusRouteDetail(
  routeName: string,
  city: string,
  signal?: AbortSignal,
): Promise<ApiResponse<{ directions: RouteDetailDirection[] }>> {
  const params = new URLSearchParams({ routeName, city });
  return narrow(await withTimeout(`/api/v1/transit/bus/route-detail?${params.toString()}`, signal), parseRouteDetail);
}

export async function searchBusRoutes(
  keyword: string,
  location?: LatLng | null,
  signal?: AbortSignal,
): Promise<ApiResponse<{ routes: BusSearchResult[] }>> {
  const params = new URLSearchParams({ keyword: keyword.trim() });
  locationParam(params, location);
  return narrow(await withTimeout(`/api/v1/transit/bus/search-routes?${params.toString()}`, signal), parseRouteSearch);
}

export async function searchBusStops(
  keyword: string,
  location?: LatLng | null,
  signal?: AbortSignal,
): Promise<ApiResponse<{ stops: BusStopSearchResult[] }>> {
  const params = new URLSearchParams({ keyword: keyword.trim() });
  locationParam(params, location);
  return narrow(await withTimeout(`/api/v1/transit/bus/search-stops?${params.toString()}`, signal), parseStopList);
}

export async function getNearbyBusStops(
  position: LatLng,
  signal?: AbortSignal,
): Promise<ApiResponse<{ stops: BusStopSearchResult[] }>> {
  const params = new URLSearchParams({ lat: String(position.lat), lng: String(position.lng) });
  return narrow(await withTimeout(`/api/v1/transit/bus/nearby-stops?${params.toString()}`, signal), parseStopList);
}
