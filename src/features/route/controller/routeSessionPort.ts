import { mapCamera, useUserLocationStore } from '@/features/map';
import { ApiError } from '@/shared/api';
import type { LatLng } from '@/shared/geo';

import { getAccessibleRoute, getLineRoutePreview } from '../api/route';
import {
  classifyRouteError,
  coordToLatLng,
  ensureMinSpan,
  normalizeWaypoints,
  planRouteRequest,
  routeBounds,
  type ComputeRouteParams,
  type RouteFailureKind,
} from '../domain/routeRequest';
import { adaptRoutePreviewRoutes } from '../domain/routePreviewAdapter';
import { hasRouteSession } from '../domain/routeSession';
import { useRouteSessionStore } from '../store/routeSessionStore';
import type { AccessibleRoute } from '../types/route';

/**
 * `RouteSessionPort`（SDD §4.3）：路線面板、AI 聊天、語音、SOS、深層連結都經過這裡算路與結束 session，
 * 不直接改 store。移植自 Web `src/hook/useComputeRoute.ts`（commit 5eadc71）的副作用部分；
 * 純邏輯在 `domain/routeRequest.ts`。
 *
 * 與 Web 的差異：
 * - 不在這裡跳 toast：回傳 `ComputeRouteResult`，由呼叫端（面板播報、AI 回覆）決定怎麼告知。
 *   失敗種類同時寫進 store 的 `lastFailure`，面板直接讀。
 * - 所有會寫入 session 的非同步動作（`computeRoute`、`loadRoutePreview`）都走同一個「請求世代」：
 *   開始時 abort 上一個並把 `requestSeq` +1，await 之後世代不符就丟棄。`endRouteSession`、
 *   `applyComputedRoutes`、距離過遠的新請求也會推進世代。Web 沒有這層保護，結束路線後才回來的
 *   回應會把 session 復活。
 * - `computeRoute` 是 async 且會 resolve 出結果：AI 與語音兩條路徑都必須 await 它（SDD §6.6 雙路徑不變量）。
 */
export type ComputeRouteResult =
  | { ok: true; routes: AccessibleRoute[] }
  | { ok: false; failure: RouteFailureKind | 'missing-input' | 'superseded' };

/** 對齊 Web `fitRouteBounds` 的 top 70／左右 40；底部由 sheet inset 決定。 */
const ROUTE_EDGE_PADDING = { top: 70, left: 40, right: 40 };

let inflight: AbortController | null = null;

/** 作廢目前的請求世代：abort 進行中的請求，晚到的回應會因世代不符而被丟棄。 */
function invalidate(): number {
  inflight?.abort();
  inflight = null;
  const seq = useRouteSessionStore.getState().requestSeq + 1;
  useRouteSessionStore.setState({ requestSeq: seq });
  return seq;
}

function beginRequest(): { seq: number; signal: AbortSignal } {
  const seq = invalidate();
  const controller = new AbortController();
  inflight = controller;
  useRouteSessionStore.setState({
    isLoading: true,
    lastFailure: null,
    // 對齊 Web `setComputeRoutes(null)`：清掉上一次的結果與附屬資料，但保留起訖點。
    computeRoutes: null,
    metroAlerts: null,
    transitAlerts: null,
    routeWaypoints: [],
  });
  return { seq, signal: controller.signal };
}

function endRequest(signal: AbortSignal): void {
  if (inflight?.signal === signal) inflight = null;
}

function isCurrent(seq: number): boolean {
  return useRouteSessionStore.getState().requestSeq === seq;
}

function fitCamera(route: AccessibleRoute, fallback: Parameters<typeof routeBounds>[1]): void {
  const bounds = routeBounds(route.legs, fallback);
  if (bounds) mapCamera.fitBounds(ensureMinSpan(bounds), ROUTE_EDGE_PADDING);
}

function fail(failure: RouteFailureKind): ComputeRouteResult {
  // 保留使用者填的起訖點，讓他調一個條件就能重試；但清掉舊結果，免得過期路線繼續畫在地圖上。
  useRouteSessionStore.setState({
    isLoading: false,
    lastFailure: failure,
    selectRoute: null,
    routeWaypoints: [],
  });
  return { ok: false, failure };
}

export async function computeRoute(params: ComputeRouteParams): Promise<ComputeRouteResult> {
  const plan = planRouteRequest(params, useUserLocationStore.getState().position);
  if (!plan.ok) {
    if (plan.reason === 'too-far') {
      // 使用者已經改了條件：之前還在跑的請求不再代表他要的路線，不能讓它晚到後蓋進來。
      invalidate();
      useRouteSessionStore.setState({ isLoading: false, lastFailure: 'too-far' });
      return { ok: false, failure: 'too-far' };
    }
    useRouteSessionStore.setState({ lastFailure: null });
    return { ok: false, failure: 'missing-input' };
  }

  const { seq, signal } = beginRequest();
  try {
    const response = await getAccessibleRoute(plan.request, signal);
    if (!isCurrent(seq)) return { ok: false, failure: 'superseded' };

    const data = response.data;
    if (!data?.routes.length) return fail('empty');

    const routes = data.routes;
    const waypoints = normalizeWaypoints(data.waypoints);
    useRouteSessionStore.setState({
      isLoading: false,
      lastFailure: null,
      computeRoutes: routes,
      metroAlerts: data.metroAlerts ?? null,
      transitAlerts: data.transitAlerts ?? null,
      slopeConstraint: data.slopeConstraint ?? null,
      selectRoute: { index: 0, route: routes[0] },
      routeWaypoints: waypoints,
    });
    fitCamera(routes[0], {
      origin: coordToLatLng(data.origin),
      destination: coordToLatLng(data.destination),
      waypoints,
    });
    return { ok: true, routes };
  } catch (error) {
    if (!isCurrent(seq)) return { ok: false, failure: 'superseded' };
    return fail(classifyRouteError(error instanceof ApiError ? error.reason : undefined));
  } finally {
    endRequest(signal);
  }
}

/** 寫入一組新結果（外部來源）。附屬資料屬於上一組結果，一併重置。 */
function commitExternalRoutes(origin: LatLng | null, destination: LatLng | null, routes: AccessibleRoute[]): void {
  useRouteSessionStore.setState({
    isLoading: false,
    lastFailure: null,
    computeRoutes: routes,
    selectRoute: { index: 0, route: routes[0] },
    routeWaypoints: [],
    metroAlerts: null,
    transitAlerts: null,
  });
  fitCamera(routes[0], { origin, destination, includeEndpoints: true });
}

/**
 * 把外部來源（SOS 前往求助者等）已算好的路線放進 session。對齊 Web
 * `useComputeRoute.setComputedRouteData`；會作廢進行中的算路。
 */
export function applyComputedRoutes(
  origin: LatLng | null,
  destination: LatLng | null,
  routes: AccessibleRoute[],
): void {
  if (!routes.length) return;
  invalidate();
  commitExternalRoutes(origin, destination, routes);
}

/** 深層連結 `route-preview/<sessionId>`（SDD §5）：取回 LINE 分享的路線並放進 session。 */
export async function loadRoutePreview(sessionId: string): Promise<boolean> {
  // 不用 beginRequest：它會先清掉使用者現有的路線結果，預覽失敗（過期、404）時舊路線就只剩一半。
  // 這裡只開新世代並顯示載入中，成功時才由 commitExternalRoutes 整組覆蓋（對齊 Web Hydrator 失敗不動現狀）。
  const seq = invalidate();
  const controller = new AbortController();
  inflight = controller;
  const { signal } = controller;
  useRouteSessionStore.setState({ isLoading: true });
  try {
    const response = await getLineRoutePreview(sessionId, signal);
    if (!isCurrent(seq)) return false;

    const data = response.data;
    const destination = coordToLatLng(data?.destination);
    const routes = data ? adaptRoutePreviewRoutes(data.routes) : [];
    if (!data || !destination || !routes.length) {
      useRouteSessionStore.setState({ isLoading: false });
      return false;
    }
    const origin = coordToLatLng(data.origin);
    const store = useRouteSessionStore.getState();
    store.setDestination(destination, data.destination.label);
    // 預覽沒有起點座標時也要寫入 null，不能讓上一個 session 的起點殘留（對齊 Web Hydrator）。
    store.setOrigin(origin, origin ? data.origin.label : '');
    commitExternalRoutes(origin, destination, routes);
    return true;
  } catch {
    if (isCurrent(seq)) useRouteSessionStore.setState({ isLoading: false });
    return false;
  } finally {
    endRequest(signal);
  }
}

/**
 * 導航重算（`nav.route_replaced`／本機 reroute）：以新版路線取代目前選中的那條，選擇的 index 不變，
 * `computeRoutes` 裡同一格一起換掉（對齊 Web `applyRouteReplacement` 對 `useMapStore` 的寫法）。
 * 沒有選中路線時（session 已結束）不動作並回傳 false——重算回應不得把已結束的 session 復活。
 */
export function replaceSelectedRoute(route: AccessibleRoute): boolean {
  const { selectRoute, computeRoutes } = useRouteSessionStore.getState();
  if (!selectRoute) return false;
  const index = selectRoute.index;
  useRouteSessionStore.setState({
    selectRoute: { index, route },
    computeRoutes: computeRoutes ? computeRoutes.map((item, i) => (i === index ? route : item)) : null,
  });
  return true;
}

/** 路線卡選擇（Web `RouteCard.handleSelect`）：換選中路線並把相機框到它。 */
export function selectRouteAt(index: number): void {
  const store = useRouteSessionStore.getState();
  store.selectRouteIndex(index);
  const route = useRouteSessionStore.getState().selectRoute?.route;
  if (route) fitCamera(route, { origin: store.origin, destination: store.destination, waypoints: store.routeWaypoints });
}

/** 「回到路線」pill（Web `RouteSessionPill`）：把相機框回選中的路線。 */
export function fitSelectedRoute(): void {
  const { selectRoute, origin, destination, routeWaypoints } = useRouteSessionStore.getState();
  if (selectRoute) fitCamera(selectRoute.route, { origin, destination, waypoints: routeWaypoints });
}

/** 唯一的結束路線入口（pill 的 ✕、結束導航、AI「取消路線」）。 */
export function endRouteSession(): void {
  inflight?.abort();
  inflight = null;
  useRouteSessionStore.getState().endRouteSession();
}

export function hasActiveRouteSession(): boolean {
  return hasRouteSession(useRouteSessionStore.getState());
}
