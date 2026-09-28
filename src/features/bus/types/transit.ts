// 移植自 Web `src/lib/api/transit.ts`（回應型別）、`src/types/transit.ts`（搜尋結果）與
// `src/types/route.ts`（`LiveBus`／`LiveBusPositionsData`），commit 5eadc71。
// 只搬本 App 用得到的型別；Google Directions 時代的 `RouteTransitDetail` 等舊型別不搬。

import type { WaitInfo } from '@/features/route/domain';

/** TDX StopStatus 對照（後端 `statusLabel` 未覆寫時的原文）。 */
export const BUS_STATUS = {
  0: '正常',
  1: '尚未發車',
  2: '交管不停靠',
  3: '末班車已過',
  4: '今日未營運',
} as const;

export interface RouteDetailStop {
  seq: number;
  name: string;
  lat: number;
  lng: number;
  estimateMinutes: number | null;
  /**
   * 複合欄位：尚未發車時後端會覆寫成下一班時刻（`18:15`、`18:15 起點發車`、`明日 06:00`），
   * 其他狀態保留原文。語意與 `/arrival` 的 `statusLabel` 不同，不可混用（SDD §6.5）。
   */
  statusLabel: string;
}

export interface RouteDetailDirection {
  direction: 0 | 1;
  stops: RouteDetailStop[];
  /** 這組站序屬於哪個子路線（99 vs 99延）。 */
  subRouteUid?: string;
  subRouteName?: string;
}

export interface BusArrivalItem {
  stopName: string;
  direction: 0 | 1;
  directionLabel: string;
  estimateMinutes: number | null;
  /** TDX StopStatus 原文；不會被覆寫成時刻。 */
  statusLabel: string;
  /** 這筆 ETA 對應的車牌（TDX 已派車時才有；後端已濾掉 "-1"）。 */
  plateNumb?: string;
  subRouteUid?: string;
  subRouteName?: string;
}

export interface BusArrivalData {
  routeName: string;
  city: string;
  stopName: string;
  arrivals: BusArrivalItem[];
}

export interface LiveBus {
  plateNumb: string;
  direction: number;
  directionLabel?: string;
  lat: number;
  lng: number;
  speed: number;
  statusLabel?: string;
  gpsTime: string;
  isLowFloor: string;
  hasLiftOrRamp: string;
  vehicleClass: string;
  routeName?: string;
  city?: string;
  waitInfo?: WaitInfo;
  stopsAway?: number;
  isTarget?: boolean;
  /** 這台車跑的子路線——一條路線的車會混著多個子路線。 */
  subRouteUid?: string;
  subRouteName?: string;
  /**
   * 這台車到 {@link etaStopName} 的分鐘數。只在 ETA 與車牌來自同一筆到站紀錄時才設——
   * 借用別台車的數字比沒有數字更糟。
   */
  estimateTime?: number | null;
  /** {@link estimateTime} 倒數的站（該 leg 的上車站）。 */
  etaStopName?: string;
}

export interface LiveBusPositionsData {
  routeName: string;
  city: string;
  count: number;
  lowFloorCount: number;
  buses: LiveBus[];
}

export interface BusSearchResult {
  routeName: string;
  city: string;
  departure: string;
  destination: string;
}

export interface BusStopSearchResult {
  stopUid: string;
  stopName: string;
  city: string;
  coordinates: [number, number]; // [lng, lat]
  routes: string[];
  /** 只有 nearby-stops 會帶（公尺）。 */
  distance?: number;
}
