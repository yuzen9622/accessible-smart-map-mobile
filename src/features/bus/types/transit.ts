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

/**
 * TDX 公車 API 的方向值：0 去程、1 返程、2 迴圈、10 循環線、255 未知。
 * OTP／GTFS 排程方向（`BusLeg.direction`）仍是 `0 | 1`，兩者不可互換。
 */
export type BusDirection = 0 | 1 | 2 | 10 | 255;

/** 可做搭乘追蹤、到站提醒的方向：255（未知）不能據此判斷車輛往哪邊開。 */
export type TrackableBusDirection = Exclude<BusDirection, 255>;

export interface RouteDetailStop {
  plateNumb?: string;
  stopUid?: string;
  seq: number;
  name: string;
  lat: number;
  lng: number;
  estimateMinutes: number | null;
  /**
   * 顯示用複合文字：可能是 TDX 狀態原文，也可能是下一班時刻（`18:15`、`18:15 起點發車`、`明日 06:00`），
   * 不是官方狀態碼，不可解析成狀態碼使用。
   */
  statusLabel: string;
}

export interface RouteDetailDirection {
  direction: BusDirection;
  stops: RouteDetailStop[];
  /** 這組站序屬於哪個子路線（99 vs 99延）。 */
  subRouteUid?: string;
  subRouteName?: string;
  /**
   * 路線幾何（TDX Bus Shape），`[lng, lat]`（GeoJSON 順序）。後端找不到可歸屬此子路線方向的
   * 線形時不給（回應為 `null`），地圖改以站序連線繪製。
   */
  polyline?: [number, number][];
}

export interface BusArrivalItem {
  stopName: string;
  direction: BusDirection;
  directionLabel: string;
  estimateMinutes: number | null;
  /** 顯示用複合文字：可能是 TDX StopStatus 原文，也可能是下一班時刻；不是官方狀態碼。 */
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
  direction: BusDirection;
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

/** `/bus/stop-arrivals` 的一列：某條路線（子路線＋方向）下一班到這個站牌的時間與車輛。 */
export interface StopArrival {
  routeName: string;
  subRouteUid?: string;
  subRouteName?: string;
  direction: BusDirection;
  /** 該子路線該方向的終點站（「往 X」）；後端查不到時為 null。 */
  headsign: string | null;
  estimateMinutes: number | null;
  /** 顯示用複合文字：可能是 TDX StopStatus 原文（正常、尚未發車、末班車已過…）或下一班時刻；不是官方狀態碼。 */
  statusLabel: string;
  plateNumb?: string;
  /** null＝車牌未知或車輛不在資料庫：不能當成「不是無障礙車」。 */
  isLowFloor: boolean | null;
  hasLiftOrRamp: boolean | null;
}

export interface StopArrivalsData {
  stopName: string;
  city: string;
  arrivals: StopArrival[];
}
