/**
 * 純 TS 型別，不 re-export `expo-location` 的型別，避免呼叫端耦合到特定定位套件。
 */

/** 對齊 SDD §4.3：map、navigation、sos、voice、hazard 都透過這個 port 取得定位，不直接呼叫 expo-location。 */
export interface GeoPosition {
  lat: number;
  lng: number;
  /** 公尺；來源回報未知時為 null。 */
  accuracy: number | null;
  /** 度數（0 = 正北，順時針）；來源回報未知時為 null。 */
  heading: number | null;
  /** 公尺／秒；來源回報未知時為 null。 */
  speed: number | null;
  /** epoch ms。 */
  timestamp: number;
}

export type LocationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export type LocationAccuracyLevel =
  | 'lowest'
  | 'low'
  | 'balanced'
  | 'high'
  | 'highest'
  | 'best-for-navigation';

export interface GetCurrentOptions {
  accuracy?: LocationAccuracyLevel;
}

export interface WatchOptions {
  accuracy?: LocationAccuracyLevel;
  /** 最小回報間隔（毫秒）。 */
  timeIntervalMs?: number;
  /** 最小回報距離（公尺）。 */
  distanceIntervalMeters?: number;
}

export type Unsubscribe = () => void;

/**
 * 前景定位 port（§4.3 跨 feature port）。背景定位（SDD §4.3 `startBackground`）在
 * `backgroundLocation.ts`：TaskManager 任務必須定義在 JS 頂層，無法做成可注入的 port 方法。
 */
export interface LocationPort {
  /** 讀取目前的前景定位權限狀態，不會跳出系統對話框。 */
  getPermissionStatus(): Promise<LocationPermissionStatus>;
  /** 跳出系統對話框請求前景定位權限；使用者已決定過時直接回傳目前狀態。 */
  requestForegroundPermission(): Promise<LocationPermissionStatus>;
  /** 取得單次目前位置。 */
  getCurrent(options?: GetCurrentOptions): Promise<GeoPosition>;
  /** 持續監看位置變化；回傳的函式呼叫後立即停止監看。 */
  watch(options: WatchOptions, onUpdate: (position: GeoPosition) => void): Promise<Unsubscribe>;
  /** 持續監看羅盤方位（度數，0 = 正北）；回傳的函式呼叫後立即停止監看。 */
  watchHeading(onUpdate: (headingDegrees: number) => void): Promise<Unsubscribe>;
}
