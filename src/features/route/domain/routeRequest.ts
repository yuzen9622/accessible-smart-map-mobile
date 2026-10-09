// 從 Web `src/hook/useComputeRoute.ts`（commit 5eadc71）抽出的純邏輯：組 request、距離檢查、
// 錯誤分類、回應 waypoint 正規化、路線 bounds。Web 版把這些寫在 hook 裡直接操作 god store
// 與 maplibre-gl 的 LngLatBounds；本版拆成純函式讓 jest 測，副作用留給 `controller/routeSessionPort.ts`。

import { haversineMeters, type LatLng } from '@/shared/geo';

import type { AccessibleRouteRequest, ApiCoordinate, EffectiveRoutePreferences, RouteLeg, RouteMode, TravelMode } from '../types/route';

// 直線距離超過這個值已遠超任何國內行程（台北–高雄約 300 km），幾乎可以確定起訖點不在服務範圍——
// 在這裡擋下能給出準確的「距離過遠」訊息，而不是暗示重試有用的「失敗，請再試一次」。
export const MAX_ROUTE_METERS = 500_000;

export interface ComputeRouteParams {
  origin?: LatLng;
  destination?: LatLng;
  waypoints?: LatLng[];
  query?: string;
  mode?: RouteMode;
  travelMode?: TravelMode;
  /** 使用者明確開啟才傳 true；未開啟就不要傳，讓後端沿用 `mode` 預設。 */
  avoidStairs?: boolean;
  requireElevator?: boolean;
  /** 使用者明確重新規劃時，沿用上一份後端確認的條件。 */
  canonicalPreferences?: EffectiveRoutePreferences;
}

export type RoutePlanResult =
  | { ok: true; request: AccessibleRouteRequest; start?: LatLng; end?: LatLng }
  | { ok: false; reason: 'missing-input' | 'too-far' };

function toApiCoordinate(p: LatLng): ApiCoordinate {
  return { latitude: p.lat, longitude: p.lng };
}

function isFiniteLatLng(p: LatLng | null | undefined): p is LatLng {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

/**
 * 組出送給 `POST /a11y/accessible-route` 的 body。後端是 Zod `.strict()`，所以只放有值的欄位，
 * 且欄位集合與 Web 版完全相同。
 *
 * 自然語言查詢交給後端從文字解析起終點；只有結構化路徑才以使用者位置補缺。
 */
export function planRouteRequest(params: ComputeRouteParams, userLocation: LatLng | null): RoutePlanResult {
  const { waypoints, query, mode, travelMode } = params;
  // 非有限座標（NaN）序列化成 JSON 會變 null → strict schema 400，一律當成沒給。
  const origin = isFiniteLatLng(params.origin) ? params.origin : undefined;
  const destination = isFiniteLatLng(params.destination) ? params.destination : undefined;
  const here = isFiniteLatLng(userLocation) ? userLocation : undefined;

  if (!query && !origin && !destination) return { ok: false, reason: 'missing-input' };

  const start = origin ?? (query ? undefined : here);
  const end = destination ?? (query ? undefined : here);

  if (!query && (!start || !end)) return { ok: false, reason: 'missing-input' };

  if (start && end && haversineMeters(start, end) > MAX_ROUTE_METERS) {
    return { ok: false, reason: 'too-far' };
  }

  const request: AccessibleRouteRequest = {};
  if (start) request.origin = toApiCoordinate(start);
  if (end) request.destination = toApiCoordinate(end);
  const validWaypoints = waypoints?.filter(isFiniteLatLng) ?? [];
  if (validWaypoints.length) request.waypoints = validWaypoints.map(toApiCoordinate);
  if (query) request.query = query;
  if (mode) request.mode = mode;
  if (travelMode) request.travelMode = travelMode;
  const preferences = params.canonicalPreferences;
  if (preferences) {
    request.transitPreference = preferences.transitPreference;
    request.maxTransfers = preferences.maxTransfers;
    if (preferences.departureTime !== undefined) request.departureTime = preferences.departureTime;
    if (preferences.needsAccessibleToilet !== undefined) request.needsAccessibleToilet = preferences.needsAccessibleToilet;
    if (preferences.needsHandrail !== undefined) request.needsHandrail = preferences.needsHandrail;
    if (preferences.maxSlopePercent !== undefined) request.maxSlopePercent = preferences.maxSlopePercent;
    // 同模式的明確 false 也是條件；改模式時保留 true，缺值交回新模式的無障礙預設。
    if (preferences.mode === mode || preferences.avoidStairs) request.avoidStairs = preferences.avoidStairs;
    if (preferences.mode === mode || preferences.requireElevator) request.requireElevator = preferences.requireElevator;
  }
  if (params.avoidStairs) request.avoidStairs = true;
  if (params.requireElevator) request.requireElevator = true;
  if (here) request.userLocation = toApiCoordinate(here);

  return { ok: true, request, start, end };
}

export type RouteFailureKind = 'too-far' | 'no-route' | 'no-accessible-route' | 'empty' | 'failed';

/** i18n key 與 Web 版 toast 文案一致；Web 的「找不到合適的無障礙路線」「路線規劃失敗」沒有 key，這裡補上 native 前綴 key。 */
export const ROUTE_FAILURE_I18N: Record<RouteFailureKind, { key: string; fallback: string }> = {
  'too-far': { key: 'routeTooFar', fallback: '起點與終點距離過遠，本服務目前涵蓋台灣' },
  'no-route': { key: 'routeErrorNoRoute', fallback: '這兩點之間找不到可行的步行路線，請試著調整起訖點' },
  'no-accessible-route': {
    key: 'routeErrorNoAccessibleRoute',
    fallback: '找不到符合你無障礙條件的路線，可試著放寬條件',
  },
  empty: { key: 'nativeRouteErrorEmpty', fallback: '找不到合適的無障礙路線' },
  failed: { key: 'nativeRouteErrorFailed', fallback: '路線規劃失敗，請稍後再試' },
};

/**
 * 422 代表請求被理解、但確實沒有答案；「請稍後再試」會是讓使用者白等的謊話，所以依 `reason` 分開。
 */
export function classifyRouteError(reason: string | undefined): RouteFailureKind {
  if (reason === 'NO_ROUTE') return 'no-route';
  if (reason === 'NO_ACCESSIBLE_ROUTE') return 'no-accessible-route';
  return 'failed';
}

type CoordLike = { lat?: unknown; latitude?: unknown; lng?: unknown; longitude?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** 後端的座標可能是 `{lat,lng}` 或 `{latitude,longitude}`；非有限數值回傳 null。 */
export function coordToLatLng(value: unknown): LatLng | null {
  if (!isRecord(value)) return null;
  const c: CoordLike = value;
  const lat = c.lat ?? c.latitude;
  const lng = c.lng ?? c.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * 回應 `waypoints` 正規化。Web 版把缺值補成 0 再濾有限數，會讓缺座標的點落在 (0,0)；
 * 本版直接丟掉無法解析的點（同樣不會畫出，但不製造假座標）。
 */
export function normalizeWaypoints(waypoints: unknown): LatLng[] {
  if (!Array.isArray(waypoints)) return [];
  return waypoints.map(coordToLatLng).filter((w): w is LatLng => w !== null);
}

/** `[west, south, east, north]`，與 maplibre-react-native `LngLatBounds` 同順序。 */
export type Bounds = [number, number, number, number];

function extend(bounds: Bounds | null, lng: number, lat: number): Bounds | null {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return bounds;
  if (!bounds) return [lng, lat, lng, lat];
  return [Math.min(bounds[0], lng), Math.min(bounds[1], lat), Math.max(bounds[2], lng), Math.max(bounds[3], lat)];
}

/**
 * 路線的相機範圍：以該路線所有 leg 的 polyline 為主；polyline 全空時退回起訖點；
 * waypoint 一律納入。全部都沒有時回傳 null（呼叫端不動相機）。對齊 Web `routeBoundsFromLegs`＋
 * `useComputeRoute` 的 fallback 流程。
 *
 * `includeEndpoints`：外部帶入的路線（LINE 預覽、SOS）一律把起訖點納入，對齊 Web
 * `RoutePreviewHydrator`——polyline 不一定畫到起訖點，pin 可能落在畫面外。
 *
 * 與 Web 的差異：Web 的起訖點 fallback 要兩點都有才納入，本版有一點就納入。
 */
export function routeBounds(
  legs: RouteLeg[],
  fallback: {
    origin?: LatLng | null;
    destination?: LatLng | null;
    waypoints?: LatLng[];
    includeEndpoints?: boolean;
  } = {},
): Bounds | null {
  let bounds: Bounds | null = null;
  for (const leg of legs) {
    for (const point of leg.polyline ?? []) {
      bounds = extend(bounds, point?.[0], point?.[1]);
    }
  }
  if (!bounds || fallback.includeEndpoints) {
    if (fallback.origin) bounds = extend(bounds, fallback.origin.lng, fallback.origin.lat);
    if (fallback.destination) bounds = extend(bounds, fallback.destination.lng, fallback.destination.lat);
  }
  for (const w of fallback.waypoints ?? []) {
    bounds = extend(bounds, w.lng, w.lat);
  }
  return bounds;
}

// 原生 `fitBounds` 沒有單次呼叫的 maxZoom；Web 用 `maxZoom: 16.5` 避免短程步行路線放大到貼臉。
// 改以「範圍至少這麼大」達到同樣效果。MapLibre zoom 以 512 px 為世界寬度基準：zoom 16.5 約每度
// 131,800 pt；直向手機 390 pt 扣左右邊距 40 後約 310 pt → 約 0.0024° 經度。緯度 25° 附近取約 0.0017°。
// 數值待 iOS 模擬器與 Web 用同一條短程路線對照後微調。
export const MIN_ROUTE_SPAN_LNG = 0.0025;
export const MIN_ROUTE_SPAN_LAT = 0.0017;

/** 把太小的範圍以中心點向外撐到最小跨度，模擬 Web 的 maxZoom 16.5。 */
export function ensureMinSpan(bounds: Bounds, minLng = MIN_ROUTE_SPAN_LNG, minLat = MIN_ROUTE_SPAN_LAT): Bounds {
  const [w, s, e, n] = bounds;
  const padLng = Math.max(0, (minLng - (e - w)) / 2);
  const padLat = Math.max(0, (minLat - (n - s)) / 2);
  return [w - padLng, s - padLat, e + padLng, n + padLat];
}
