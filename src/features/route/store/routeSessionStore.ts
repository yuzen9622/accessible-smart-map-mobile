import { create } from 'zustand';

import type { LatLng } from '@/shared/geo';

import type { RouteFailureKind } from '../domain/routeRequest';
import type { AccessibleRoute, MatchedAlert, MetroAlertResult } from '../types/route';

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

export interface RouteSessionState {
  origin: LatLng | null;
  originName: string;
  destination: LatLng | null;
  destinationName: string;
  computeRoutes: AccessibleRoute[] | null;
  selectRoute: SelectedRoute | null;
  routeWaypoints: LatLng[];
  metroAlerts: MetroAlertResult[] | null;
  transitAlerts: MatchedAlert[] | null;
  isLoading: boolean;
  lastFailure: RouteFailureKind | null;
  /** 每次開始算路或結束 session 都 +1；晚到的回應比對不上就丟掉。 */
  requestSeq: number;

  setOrigin: (origin: LatLng | null, name?: string) => void;
  setDestination: (destination: LatLng | null, name?: string) => void;
  swapEndpoints: () => void;
  selectRouteIndex: (index: number) => void;
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
  origin: null,
  originName: '',
  destination: null,
  destinationName: '',
  computeRoutes: null,
  selectRoute: null,
  routeWaypoints: [],
  metroAlerts: null,
  transitAlerts: null,
  isLoading: false,
  lastFailure: null,
} satisfies Partial<RouteSessionState>;

export const useRouteSessionStore = create<RouteSessionState>()((set, get) => ({
  ...CLEARED_SESSION,
  requestSeq: 0,

  setOrigin: (origin, name = '') => set({ origin, originName: name }),
  setDestination: (destination, name = '') => set({ destination, destinationName: name }),
  swapEndpoints: () => {
    const { origin, originName, destination, destinationName } = get();
    set({ origin: destination, originName: destinationName, destination: origin, destinationName: originName });
  },
  selectRouteIndex: (index) => {
    const routes = get().computeRoutes;
    const route = routes?.[index];
    if (!route) return;
    set({ selectRoute: { index, route } });
  },
  endRouteSession: () => set((s) => ({ ...CLEARED_SESSION, requestSeq: s.requestSeq + 1 })),
}));
