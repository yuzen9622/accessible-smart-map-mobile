import { fetchRequest, getAccessToken, type ApiResponse } from '@/shared/api';
import { getAppConfig } from '@/shared/config';

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
    return (Array.isArray(record.polyline) ? record : { ...record, polyline: [] }) as unknown as RouteLeg;
  });
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
  return { ...(value as unknown as AccessibleRouteData), routes };
}

function isNavInstruction(value: unknown): boolean {
  return isRecord(value) && typeof value.text === 'string' && typeof value.type === 'string';
}

function parseNavInstructionsData(value: unknown): NavInstructionsData | undefined {
  if (!isRecord(value) || !Array.isArray(value.instructions) || !value.instructions.every(isNavInstruction)) {
    return undefined;
  }
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
  return { ...(value as unknown as AccessibleRouteRerouteData), route: withRouteDefaults(value.route, 0) };
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
  return narrow(response, parseAccessibleRouteData);
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
  };
  const response = await fetchRequest(url('/api/v1/a11y/accessible-route/reroute'), {
    method: 'POST',
    body,
    signal,
    timeoutMs: ROUTE_TIMEOUT_MS,
  });
  return narrow(response, parseRerouteData);
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
