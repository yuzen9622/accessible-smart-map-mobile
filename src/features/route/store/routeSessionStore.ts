import { create } from 'zustand';

import { PINNED_FACILITY_CATEGORIES, type PinnedFacilityCategory } from '@/features/map';
import type { LatLng } from '@/shared/geo';

import type { RouteFailureKind } from '../domain/routeRequest';
import type { AiRoutePlan, EffectiveRoutePreferences, AccessibleRoute, LngLatTuple, MatchedAlert, MetroAlertResult, RouteMode, SlopeConstraint, TravelMode, VenueDestination, VenueEndpoint, VenueArrival, VenueHandoff } from '../types/route';
import type { VenueRoute } from '@/shared/venue';

/**
 * 移植自 Web `src/stores/map/createRouteSlice.ts`（commit 5eadc71）的路線欄位；拆出 route feature
 * 自己擁有，不進 god store（ADR-14）。非持久化：路線 token 30 分鐘就過期，冷啟動不還原。
 *
 * 與 Web 的差異：
 * - `setRouteSelect` 在換路線時清掉的 `activeBusLeg`／`liveBusPositions` 屬於公車 feature，
 *   由公車 feature 自己訂閱 `selectRoute.index` 變化清除，這裡不跨 feature 寫別人的狀態。
 * - `routeInfoShow`（Web 用來切換規劃表單／結果面板）改由 sheet 路由表達，不存狀態。
 * - 新增 `isLoading`／`lastFailure`／`requestSeq`：Web 的 loading 是 hook 內 local state；
 *   這裡放進 store 讓 AI／語音路徑（`RouteSessionPort.computeRoute`）與面板看到同一份。
 */
export interface SelectedRoute {
  index: number;
  route: AccessibleRoute;
}

/**
 * 地圖上暫時替換某段公車 leg 的線形：路線詳情查看別班候選公車、而那班走的路不同時，地圖跟著畫那班的路。
 * 只影響地圖，不改路線本身（導航仍走規劃的那班）。
 */
export interface LegGeometryPreview {
  routeId: string;
  legIndex: number;
  polyline: LngLatTuple[];
}

export interface RouteSessionState {
  planId: string | null;
  selectedRouteId: string | null;
  effectivePreferences: EffectiveRoutePreferences | null;
  /** 表單輸入保留至下一次明確修改；請求開始時不能回退個人預設而觸發第二次規劃。 */
  planningPreferences: EffectiveRoutePreferences | null;
  plan: AiRoutePlan | null;
  navigationRoute: SelectedRoute | null;
  invalidRouteTokens: string[];
  origin: LatLng | null;
  originName: string;
  originVenuePlace: VenueDestination | null;
  destination: LatLng | null;
  destinationName: string;
  destinationVenuePlace: VenueDestination | null;
  venueArrival: VenueArrival | null;
  venueLeg: VenueRoute | null;
  indoorRoute: VenueRoute | null;
  navigationVenueHandoff: VenueHandoff | null;
  computeRoutes: AccessibleRoute[] | null;
  selectRoute: SelectedRoute | null;
  legGeometryPreview: LegGeometryPreview | null;
  routeWaypoints: LatLng[];
  metroAlerts: MetroAlertResult[] | null;
  transitAlerts: MatchedAlert[] | null;
  slopeConstraint: SlopeConstraint | null;
  isLoading: boolean;
  lastFailure: RouteFailureKind | null;
  /**
   * 目前結果是用哪組規劃條件算的（`planRequestKey`）。規劃卡據此決定要不要自動重算：
   * 條件沒變就沿用結果（保留使用者選的那條），變了才重算。其他來源（AI、SOS）寫入的結果為 null。
   */
  computedFor: string | null;
  /** 每次開始算路或結束 session 都 +1；晚到的回應比對不上就丟掉。 */
  requestSeq: number;
  /** Conversation results are invalidated independently of an in-flight manual HTTP request. */
  selectionGeneration: number;
  /**
   * 規劃表單的偏好（Web `RoutePlanContent` 的 local state）。刻意不在 CLEARED_SESSION：
   * 結束一條路線不代表使用者改了交通方式。`routeMode` 為 null 時跟隨 onboarding 需求輪廓。
   */
  travelMode: TravelMode;
  routeMode: RouteMode | null;
  /** 路線沿途要顯示哪些無障礙設施類別（使用者回饋 2026-10-15：圖示太亂，要能篩選）；
   * 預設全選，跟規劃路線「想先知道路上有哪些設施」的用途一致，不是首頁地圖預設空的那套。 */
  facilityFilter: PinnedFacilityCategory[];

  setOrigin: (origin: LatLng | null, name?: string) => void;
  setDestination: (destination: LatLng | null, name?: string) => void;
  setVenueEndpoint: (field: 'origin' | 'destination', endpoint: VenueEndpoint) => void;
  swapEndpoints: () => void;
  selectRouteIndex: (index: number) => void;
  setTravelMode: (travelMode: TravelMode) => void;
  setRouteMode: (routeMode: RouteMode | null) => void;
  toggleFacilityFilter: (category: PinnedFacilityCategory) => void;
  /**
   * 清除路線 session 的唯一實作（SDD §6.3 不變量）。feature 內部使用；外部一律呼叫
   * `RouteSessionPort.endRouteSession`，它會先 abort 進行中的網路請求。
   */
  endRouteSession: () => void;
}

// 每個會把路線幾何放上地圖、或餵給描述它的面板的欄位都列在這裡。集中列出就是重點：
// Web 曾有四份手抄清單各漏一部分，全都漏了 origin／destination——所以目的地 pin 撐過了每次切換面板。
// 刻意**不含**地點詳情（place feature 的 selectedPlace）：使用者可能在看無關地點時按 pill 的 ✕，
// 把他正在看的面板清空是錯的。
const CLEARED_SESSION = {
  planId: null,
  selectedRouteId: null,
  effectivePreferences: null,
  planningPreferences: null,
  plan: null,
  navigationRoute: null,
  invalidRouteTokens: [],
  origin: null,
  originName: '',
  originVenuePlace: null,
  destination: null,
  destinationName: '',
  destinationVenuePlace: null,
  venueArrival: null,
  venueLeg: null,
  indoorRoute: null,
  navigationVenueHandoff: null,
  computeRoutes: null,
  selectRoute: null,
  legGeometryPreview: null,
  routeWaypoints: [],
  metroAlerts: null,
  transitAlerts: null,
  slopeConstraint: null,
  isLoading: false,
  lastFailure: null,
  computedFor: null,
} satisfies Partial<RouteSessionState>;

export const useRouteSessionStore = create<RouteSessionState>()((set, get) => ({
  ...CLEARED_SESSION,
  requestSeq: 0,
  selectionGeneration: 0,
  travelMode: 'transit',
  routeMode: null,
  facilityFilter: [...PINNED_FACILITY_CATEGORIES],

  setOrigin: (origin, name = '') => set((state) => ({
    origin, originName: name, originVenuePlace: null,
    ...(state.origin?.lat === origin?.lat && state.origin?.lng === origin?.lng && !state.originVenuePlace ? {} : invalidateResult(state)),
  })),
  setDestination: (destination, name = '') => set((state) => ({
    destination, destinationName: name, destinationVenuePlace: null,
    ...(destination !== null && state.destination?.lat === destination.lat && state.destination?.lng === destination.lng && !state.destinationVenuePlace
      ? {} : invalidateResult(state)),
  })),
  setVenueEndpoint: (field, endpoint) => set((state) => {
    const current = field === 'origin' ? state.originVenuePlace : state.destinationVenuePlace;
    const unchanged = current?.venueId === endpoint.venueId && current.placeId === endpoint.placeId &&
      current.sourceVersion === endpoint.sourceVersion && current.buildingId === endpoint.buildingId && current.levelRef === endpoint.levelRef;
    return {
      ...(unchanged ? {} : invalidateResult(state)),
      ...(field === 'origin'
        ? { origin: unchanged ? state.origin : endpoint.position, originName: endpoint.name, originVenuePlace: { ...endpoint } }
        : { destination: unchanged ? state.destination : endpoint.position, destinationName: endpoint.name, destinationVenuePlace: { ...endpoint } }),
    };
  }),
  swapEndpoints: () => {
    const state = get();
    const { origin, originName, destination, destinationName } = state;
    set({ ...invalidateResult(state), origin: destination, originName: destinationName,
      originVenuePlace: state.destinationVenuePlace, destination: origin, destinationName: originName,
      destinationVenuePlace: state.originVenuePlace });
  },
  selectRouteIndex: (index) => {
    const routes = get().computeRoutes;
    const route = routes?.[index];
    if (!route) return;
    if (get().selectRoute?.route === route) return;
    set({ selectRoute: { index, route }, selectedRouteId: route.routeId, requestSeq: get().requestSeq + 1, selectionGeneration: get().selectionGeneration + 1 });
  },
  setTravelMode: (travelMode) => set((state) => ({ travelMode, ...(state.travelMode === travelMode ? {} : invalidateResult(state)) })),
  setRouteMode: (routeMode) => set((state) => ({ routeMode, ...(state.routeMode === routeMode ? {} : invalidateResult(state)) })),
  toggleFacilityFilter: (category) =>
    set((state) => ({
      facilityFilter: state.facilityFilter.includes(category)
        ? state.facilityFilter.filter((c) => c !== category)
        : [...state.facilityFilter, category],
    })),
  endRouteSession: () => set((s) => ({ ...CLEARED_SESSION, requestSeq: s.requestSeq + 1, selectionGeneration: s.selectionGeneration + 1 })),
}));

/** A changed input must not retain a handoff from a different campus journey. */
function invalidateResult(state: RouteSessionState): Partial<RouteSessionState> {
  return {
    venueArrival: null, venueLeg: null, indoorRoute: null, computeRoutes: null, selectRoute: null,
    selectedRouteId: null, planId: null, plan: null, effectivePreferences: null,
    legGeometryPreview: null, routeWaypoints: [], metroAlerts: null, transitAlerts: null, slopeConstraint: null,
    computedFor: null, isLoading: false, lastFailure: null,
    requestSeq: state.requestSeq + 1, selectionGeneration: state.selectionGeneration + 1,
  };
}
