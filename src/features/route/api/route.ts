import { fetchRequest, getAccessToken, type ApiResponse } from '@/shared/api';
import { getAppConfig } from '@/shared/config';
import { parseVenueRoute } from '@/shared/venue';

import { recordRouteNameLanguage } from '../domain/routeNames';

import type {
  AccessibleRoute,
  AccessibleRouteData,
  AccessibleRouteRequest,
  AccessibleRouteRerouteData,
  AccessibleRouteRerouteRequest,
  NavInstructionsData,
  NavInstructionsRequest,
  RouteLeg,
  RoutePreviewPageData,
  VenueArrival,
} from '../types/route';

/**
 * 移植自 Web `src/lib/api/a11y.ts`（`getAccessibleRoute`／`rerouteAccessibleRoute`／
 * `getRouteInstructions`）與 `src/lib/api/line.ts`（`getLineRoutePreview`），commit 5eadc71。
 *
 * 差異：
 * - 改用 `shared/api` 的 `fetchRequest` 與 `getAppConfig().apiBaseUrl`；所有函式可帶 `AbortSignal`。
 * - 回應只驗外層骨架（`routes[]`、每條 `legs[]`、每段有 `type`），刻意寬鬆：Web 端對 `routeId`、
 *   `polyline` 都寫了 fallback（`route.routeId || …`、`leg.polyline ?? []`），代表後端可能缺這些欄位；
 *   驗太嚴會讓一條壞資料把整批路線丟掉，使用者只看到「找不到路線」。缺的欄位在這裡補預設值。
 * - request body 一律以白名單組出，後端是 Zod `.strict()`，多一個欄位就 400。
 * - `as unknown as` 只出現在本檔的 parse 邊界：輸入是 `unknown`，逐欄收窄整棵路線樹不划算，
 *   所以先驗骨架（含已知 leg type）再斷言；其他檔案不得這樣寫。
 * - **身分**（後端確認，2026-09-29）：後端所有業務 API 都吃 `Authorization: Bearer <access token>`，cookie 只放
 *   refresh token、僅供 Web refresh／logout。Web 呼叫這三支時沒有帶 `requireAuth`，實際上也是匿名送出，
 *   本版行為與 Web 相同。若 Phase 3 決定登入者算路要帶身分：有 session 時帶 Bearer，過期 401、無效 403，
 *   不得自動降級匿名重送（SDD §6.3）；`/route/instructions` 是例外，不適用這組 401／403 語意（以 routeToken 為準）。
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const KNOWN_LEG_TYPES: readonly string[] = ['WALK', 'BUS', 'METRO', 'THSR', 'TRA', 'DRIVE', 'MOTORCYCLE'];

/** 未知運具（後端新增的 leg type）整條路線丟棄：UI 與 adapter 的 switch 都沒有對應分支。 */
function isLegShape(value: unknown): boolean {
  return isRecord(value) && typeof value.type === 'string' && KNOWN_LEG_TYPES.includes(value.type);
}

function isRouteShape(value: unknown): value is Record<string, unknown> & { legs: unknown[] } {
  return isRecord(value) && Array.isArray(value.legs) && value.legs.every(isLegShape);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** 補上 UI 與導航假設一定存在的欄位。輸入已通過 `isRouteShape`。 */
function withRouteDefaults(raw: Record<string, unknown> & { legs: unknown[] }, index: number): AccessibleRoute {
  const legs = raw.legs.map((leg) => {
    const record = leg as Record<string, unknown>;
    // SAFETY: isRouteShape checked each leg is a record with a known type; polyline is an array or defaulted here.
    // Remaining per-mode fields/coordinate contents rely on the backend DTO, not deep runtime validation.
    return (Array.isArray(record.polyline) ? record : { ...record, polyline: [] }) as unknown as RouteLeg;
  });
  // SAFETY: raw passed isRouteShape and legs now have polyline defaults; scalar defaults are applied below.
  // Optional metadata and per-mode nested fields remain backend-contract assumptions, not fully validated.
  const route = { ...raw, legs } as unknown as AccessibleRoute;
  return {
    ...route,
    routeId: typeof raw.routeId === 'string' && raw.routeId ? raw.routeId : `route-${index}`,
    routeName: typeof raw.routeName === 'string' ? raw.routeName : '',
    totalMinutes: isFiniteNumber(raw.totalMinutes) ? raw.totalMinutes : 0,
    transferCount: isFiniteNumber(raw.transferCount) ? raw.transferCount : 0,
    accessibilityHighlights: Array.isArray(raw.accessibilityHighlights) ? route.accessibilityHighlights : [],
  };
}

export function parseAccessibleRouteData(value: unknown): AccessibleRouteData | undefined {
  if (!isRecord(value) || !Array.isArray(value.routes)) return undefined;
  const routes = value.routes.filter(isRouteShape).map(withRouteDefaults);
  // SAFETY: value is a record with routes[]; only shape-checked routes with defaults survive above.
  // Other envelope fields are preserved under the backend DTO contract, without deep validation.
  return { ...(value as unknown as AccessibleRouteData), routes, ...parseVenueFields(value) };
}

/** Venue metadata is an inseparable handoff; malformed data must not become a gate-only success. */
function parseVenueFields(value: Record<string, unknown>): Pick<AccessibleRouteData, 'venueArrival' | 'venueLeg'> {
  if (value.venueArrival === undefined && value.venueLeg === undefined) return {};
  const raw = value.venueArrival;
  if (!isRecord(raw) || typeof raw.venueId !== 'string' || !raw.venueId ||
      typeof raw.placeId !== 'string' || !raw.placeId || typeof raw.gateId !== 'string' || !raw.gateId ||
      !isRecord(raw.gateLocation) || !isFiniteNumber(raw.gateLocation.lat) || !isFiniteNumber(raw.gateLocation.lng) ||
      Math.abs(raw.gateLocation.lat) > 90 || Math.abs(raw.gateLocation.lng) > 180 ||
      !Number.isSafeInteger(raw.venueVersion) || typeof raw.venueVersion !== 'number' || raw.venueVersion < 1 ||
      (raw.mode !== 'normal' && raw.mode !== 'wheelchair' && raw.mode !== 'elderly' && raw.mode !== 'visual_impaired')) {
    throw new Error('INVALID_VENUE_ARRIVAL');
  }
  const venueArrival: VenueArrival = {
    venueId: raw.venueId, placeId: raw.placeId, gateId: raw.gateId,
    gateLocation: { lat: raw.gateLocation.lat, lng: raw.gateLocation.lng },
    mode: raw.mode, venueVersion: raw.venueVersion,
  };
  const venueLeg = parseVenueRoute(value.venueLeg, {
    venueId: venueArrival.venueId, fromPlaceId: venueArrival.gateId,
    toPlaceId: venueArrival.placeId, mode: venueArrival.mode,
  });
  if (venueLeg.venueVersion !== venueArrival.venueVersion) throw new Error('VENUE_VERSION_MISMATCH');
  return { venueArrival, venueLeg };
}

function isNavInstruction(value: unknown): boolean {
  return isRecord(value) && typeof value.text === 'string' && typeof value.type === 'string';
}

function parseNavInstructionsData(value: unknown): NavInstructionsData | undefined {
  if (!isRecord(value) || !Array.isArray(value.instructions) || !value.instructions.every(isNavInstruction)) {
    return undefined;
  }
  // SAFETY: instructions is an array of records with string text/type. Other instruction fields and
  // envelope metadata rely on the backend contract; this guard is intentionally not a full schema validator.
  return value as unknown as NavInstructionsData;
}

function parseRerouteData(value: unknown): AccessibleRouteRerouteData | undefined {
  if (!isRecord(value)) return undefined;
  const list = value.instructions ?? value.steps;
  if (
    typeof value.navigationId !== 'string' ||
    typeof value.routeVersion !== 'number' ||
    typeof value.routeToken !== 'string' ||
    !isRouteShape(value.route) ||
    !Array.isArray(list) ||
    !list.every(isNavInstruction)
  ) {
    return undefined;
  }
  // SAFETY: the guard checked navigationId/token strings, numeric version, known route leg types,
  // and an instructions/steps list with string text/type. Replay/warnings and deeper fields are DTO assumptions.
  return { ...(value as unknown as AccessibleRouteRerouteData), route: withRouteDefaults(value.route, 0), ...parseVenueFields(value) };
}

function parseRoutePreviewPageData(value: unknown): RoutePreviewPageData | undefined {
  if (
    !isRecord(value) ||
    typeof value.sessionId !== 'string' ||
    !isRecord(value.destination) ||
    !Array.isArray(value.routes) ||
    !value.routes.every(isRecord)
  ) {
    return undefined;
  }
  const routes = value.routes.filter((r) => Array.isArray(r.legs) && r.legs.every(isLegShape));
  // SAFETY: the guard checked sessionId, destination record and routes records; the filter checked
  // legs[] and known leg types. Coordinates, mode-specific fields and other metadata are not deeply validated.
  return { ...(value as unknown as RoutePreviewPageData), routes: routes as unknown as RoutePreviewPageData['routes'] };
}

function narrow<T>(response: ApiResponse<unknown>, parse: (value: unknown) => T | undefined): ApiResponse<T> {
  const data: T | undefined = parse(response.data);
  return { ...response, data };
}

/**
 * 算路／重算的逾時。後端冷快取時跨縣市的大眾運輸路線實測可到 23 秒以上（2026-10-02），共用的 20 秒預設會在
 * 後端還在算時就放棄，使用者只看到「路線規劃失敗」；Web 版這兩支沒有逾時，所以同一條路線在 Web 算得出來。
 */
export const ROUTE_TIMEOUT_MS = 60_000;

function url(path: string): string {
  return `${getAppConfig().apiBaseUrl}${path}`;
}

export async function getAccessibleRoute(
  request: AccessibleRouteRequest,
  signal?: AbortSignal,
): Promise<ApiResponse<AccessibleRouteData>> {
  // 登入時帶 Bearer，後端會把已儲存的無障礙 profile 當作未明確傳入欄位的預設值。過期 401／無效 403 不降級匿名重送
  // （`requireAuth` 會先 refresh 再重試；仍失敗就讓錯誤浮出）。未登入不能設 `requireAuth`，否則會送出 `Bearer undefined`。
  const response = await fetchRequest(url('/api/v1/a11y/accessible-route'), {
    method: 'POST',
    body: request,
    signal,
    requireAuth: Boolean(getAccessToken()),
    timeoutMs: ROUTE_TIMEOUT_MS,
  });
  const parsed = narrow(response, parseAccessibleRouteData);
  const language = request.language;
  if (language) parsed.data?.routes.forEach((route) => recordRouteNameLanguage(route, language));
  return parsed;
}

export async function rerouteAccessibleRoute(
  request: AccessibleRouteRerouteRequest,
  signal?: AbortSignal,
): Promise<ApiResponse<AccessibleRouteRerouteData>> {
  const { latitude, longitude, accuracy } = request.currentPosition;
  const body: AccessibleRouteRerouteRequest = {
    routeToken: request.routeToken,
    currentPosition: isFiniteNumber(accuracy) ? { latitude, longitude, accuracy } : { latitude, longitude },
    previousRouteVersion: request.previousRouteVersion,
    reason: request.reason,
    clientRequestId: request.clientRequestId,
    ...(request.language ? { language: request.language } : {}),
  };
  const response = await fetchRequest(url('/api/v1/a11y/accessible-route/reroute'), {
    method: 'POST',
    body,
    signal,
    timeoutMs: ROUTE_TIMEOUT_MS,
  });
  const parsed = narrow(response, parseRerouteData);
  // Idempotent replay may belong to a different original request language.
  if (request.language && parsed.data?.replayed === false) recordRouteNameLanguage(parsed.data.route, request.language);
  return parsed;
}

/** body 只能有 `routeToken`／`userHeading`／`language`，不得送整個 route 物件（SDD §6.3）。 */
export async function getRouteInstructions(
  request: NavInstructionsRequest,
  signal?: AbortSignal,
): Promise<ApiResponse<NavInstructionsData>> {
  const body: NavInstructionsRequest = { routeToken: request.routeToken };
  // heading 還沒就緒時可能是 NaN，JSON 會把它變成 null → strict schema 400。
  if (isFiniteNumber(request.userHeading)) body.userHeading = request.userHeading;
  if (request.language) body.language = request.language;
  const response = await fetchRequest(url('/api/v1/a11y/route/instructions'), { method: 'POST', body, signal });
  return narrow(response, parseNavInstructionsData);
}

export async function getLineRoutePreview(
  sessionId: string,
  signal?: AbortSignal,
): Promise<ApiResponse<RoutePreviewPageData>> {
  const response = await fetchRequest(url(`/api/v1/line/route-preview?sessionId=${encodeURIComponent(sessionId)}`), {
    method: 'GET',
    signal,
  });
  return narrow(response, parseRoutePreviewPageData);
}
