// 移植自 Web `src/types/route.ts`、`src/types/transit-alert.ts`、`src/types/line.ts`（commit 5eadc71）。
// 只搬路線／導航相關的型別；危險通報、福利機構、停車、公車到站等型別隨各自 feature 移植。
// 型別對齊後端 OpenAPI（POST /a11y/accessible-route）；後端為 Zod `.strict()`，request 多帶欄位即 400。

export type LngLatTuple = [number, number]; // [lng, lat]

// --- Transit operating alerts（/transit/alerts；路線回應可選帶） ---
export type MatchKind = 'route' | 'stop' | 'station' | 'line' | 'train' | 'section';

export interface MatchedAlert {
  alertId: string;
  title: string;
  description: string;
  status: number | string;
  cause?: number | string;
  effect?: number | string;
  level?: number | string;
  reason?: string;
  matchKind: MatchKind;
  startTime?: string | null;
  endTime?: string | null;
  alertUrl?: string;
}

export interface MetroAlert {
  alertId: string;
  title: string;
  description: string;
  status: number;
  stations: { id: string; name: string | null }[];
  lines: string[];
  publishTime: string;
  updateTime: string;
}

export type TransitAlert = MatchedAlert | MetroAlert;

/** 路線回應頂層的 `metroAlerts`，依搭乘的軌道系統分組。 */
export interface MetroAlertResult {
  railSystem: string;
  updatedAt: string;
  alerts: MetroAlert[];
}

// --- GeoJSON ---
export interface GeoPoint {
  type: 'Point';
  coordinates: LngLatTuple;
}

export interface SlimOsmA11y {
  osmId: string;
  name?: string;
  category: 'wheelchair_accessible' | 'kerb_cut' | 'ramp' | 'elevator' | 'toilet';
  wheelchair?: 'yes' | 'limited' | 'no';
  tags?: Record<string, string>;
  location: GeoPoint;
}

export interface WaitInfo {
  time: number | string | null;
  source: 'realtime' | 'schedule' | 'unavailable';
}

export interface NearestBus {
  plateNumb: string;
  position: LngLatTuple;
  speed?: number;
  stopsAway?: number;
}

export interface ExitInfo {
  exitName: string;
  exitNumber: string;
  type: 'elevator' | 'ramp';
  coords: LngLatTuple;
}

export interface IntermediateStop {
  name: string;
  stationUid?: string;
  location?: LngLatTuple;
}

export type A11yFeature =
  | 'elevator'
  | 'escalator'
  | 'moving_walkway'
  | 'ramp'
  | 'curb_ramp_crossing'
  | 'crossing'
  | 'stairs'
  | 'fare_gate'
  | 'exit_gate';

/**
 * leg `polyline` 的索引區間（兩端皆含）。區間已排序且不重疊。
 * `startIndex === endIndex` 是點狀設施（電梯兩端共用同一地面座標），不是零長度線段。
 */
export interface A11ySegment {
  feature: A11yFeature;
  startIndex: number;
  endIndex: number;
  indoor: boolean;
  distanceM: number | null;
  maxSlopePercent: number | null;
  minWidthCm: number | null;
}

export type WalkRelativeDirection =
  | 'DEPART'
  | 'CONTINUE'
  | 'STRAIGHT'
  | 'LEFT'
  | 'RIGHT'
  | 'SLIGHTLY_LEFT'
  | 'SLIGHTLY_RIGHT'
  | 'HARD_LEFT'
  | 'HARD_RIGHT'
  | 'UTURN_LEFT'
  | 'UTURN_RIGHT'
  | 'CIRCLE_CLOCKWISE'
  | 'CIRCLE_COUNTERCLOCKWISE'
  | 'ELEVATOR'
  | 'ESCALATOR'
  | 'MOVING_WALKWAY'
  | 'FARE_GATE'
  | 'ENTER_STATION'
  | 'EXIT_STATION';

export type WalkAbsoluteDirection =
  | 'NORTH'
  | 'NORTHEAST'
  | 'EAST'
  | 'SOUTHEAST'
  | 'SOUTH'
  | 'SOUTHWEST'
  | 'WEST'
  | 'NORTHWEST';

export interface WalkStep {
  relativeDirection: WalkRelativeDirection;
  absoluteDirection: WalkAbsoluteDirection | null;
  streetName: string;
  bogusName: boolean;
  area: boolean;
  stairs: boolean;
  steepSlope: boolean;
  distanceM: number;
  location: LngLatTuple;
}

export interface DriveStep {
  instruction: string;
  maneuver?: string;
  distanceM: number;
  durationMin: number;
  polyline: LngLatTuple[];
}

// --- Leg（以 `type` 區分的 discriminated union） ---
export interface WalkLeg {
  type: 'WALK';
  from: string;
  to: string;
  distanceM: number;
  minutesEst: number;
  polyline: LngLatTuple[];
  a11yFacilities: SlimOsmA11y[];
  a11yRefs?: string[];
  exitInfo?: ExitInfo | null;
  steps?: WalkStep[];
  maxSlopePercent?: number | null;
  crossings?: number | null;
  crossingsWithCurbRamp?: number | null;
  minPathWidthCm?: number | null;
  surfaceType?: string;
  /** 這段步行沿線的政府人行道路段登記的斜坡道數量——整段的計數，不是路徑上的位置。 */
  sidewalkRampCount?: number;
  /** 只在 `engine: "pedestrian-a11y"` 路線出現。空陣列＝查過但沒有可分類的；缺欄位＝沒查過。 */
  a11ySegments?: A11ySegment[];
}

export interface BusLeg {
  type: 'BUS';
  routeName: string;
  /**
   * 規劃器選的那一個班次路線。TDX 把一條路線拆成多個子路線（99／99延、6268／6268F…），
   * 名稱相同但站序不同，所以查到站、位置、站序時要用這個，不是 `routeName`。
   */
  subRouteUid?: string;
  /** {@link subRouteUid} 的顯示名稱，也是 TDX 查詢要的名稱。 */
  subRouteName?: string;
  departureStop: string;
  arrivalStop: string;
  departureStopId?: string;
  arrivalStopId?: string;
  tdxCity?: string;
  cityCode?: string;
  departureTime?: string;
  arrivalTime?: string;
  waitInfo: WaitInfo;
  estimatedWaitMinutes: number;
  /** 不可信：TDX 兩方向編號不一致，問 TDX 前要先 `resolveLegDirection`（SDD §6.5）。 */
  direction: 0 | 1;
  polyline: LngLatTuple[];
  departureStopA11y: SlimOsmA11y[];
  arrivalStopA11y: SlimOsmA11y[];
  nearestBus?: NearestBus;
  a11yRefs?: string[];
  intermediateStops?: IntermediateStop[];
  alerts?: MatchedAlert[];
}

export interface MetroLeg {
  type: 'METRO';
  railSystem: string;
  lineId: string;
  lineName: string;
  lineUid: string;
  departureStation: string;
  arrivalStation: string;
  departureStationUid: string;
  arrivalStationUid: string;
  direction: 0 | 1;
  stopsCount: number;
  rideMinutes: number;
  departureTime?: string;
  arrivalTime?: string;
  waitInfo: WaitInfo;
  estimatedWaitMinutes: number;
  polyline: LngLatTuple[];
  departureStationA11y: SlimOsmA11y[];
  arrivalStationA11y: SlimOsmA11y[];
  facilityHighlights: string[];
  a11yRefs?: string[];
  intermediateStops?: IntermediateStop[];
  alerts?: MetroAlert[];
}

export interface ThsrLeg {
  type: 'THSR';
  trainNo: string;
  departureStation: string;
  arrivalStation: string;
  departureStationUID: string;
  arrivalStationUID: string;
  departureTime: string;
  arrivalTime: string;
  rideMinutes: number;
  waitInfo: WaitInfo;
  estimatedWaitMinutes: number;
  polyline: LngLatTuple[];
  departureStationA11y: SlimOsmA11y[];
  arrivalStationA11y: SlimOsmA11y[];
  facilityHighlights: string[];
  a11yRefs?: string[];
  intermediateStops?: IntermediateStop[];
  alerts?: MatchedAlert[];
}

export interface TraLeg {
  type: 'TRA';
  trainNo: string;
  trainTypeName: string;
  departureStation: string;
  arrivalStation: string;
  departureStationUID: string;
  arrivalStationUID: string;
  departureTime: string;
  arrivalTime: string;
  rideMinutes: number;
  waitInfo: WaitInfo;
  estimatedWaitMinutes: number;
  polyline: LngLatTuple[];
  departureStationA11y: SlimOsmA11y[];
  arrivalStationA11y: SlimOsmA11y[];
  facilityHighlights: string[];
  a11yRefs?: string[];
  intermediateStops?: IntermediateStop[];
  alerts?: MatchedAlert[];
}

export type TrafficLevel = 'light' | 'moderate' | 'heavy' | 'severe' | 'closed' | 'unknown';

export interface DriveTrafficSegment {
  fromIndex: number;
  toIndex: number;
  trafficLevel: TrafficLevel;
  congestionLevel: number;
}

export interface DriveIncident {
  incidentId: string;
  title: string;
  description?: string;
  severity: 'closure' | 'advisory';
  location: { lat: number; lng: number };
}

export interface DriveLeg {
  type: 'DRIVE' | 'MOTORCYCLE';
  label?: string;
  from: string;
  to: string;
  distanceM: number;
  durationMinutes?: number;
  durationMin: number;
  durationInTrafficMin?: number;
  trafficLevel?: TrafficLevel;
  trafficSegments?: DriveTrafficSegment[];
  incidents?: DriveIncident[];
  summary?: string;
  modeFallback?: 'DRIVE';
  departureTime?: string | null;
  arrivalTime?: string | null;
  polyline: LngLatTuple[];
  steps?: DriveStep[];
}

export type RouteLeg = WalkLeg | BusLeg | MetroLeg | ThsrLeg | TraLeg | DriveLeg;
export type RouteLegType = RouteLeg['type'];

export interface ScoreComponents {
  facilityScore: number;
  timeScore: number;
  criticalFeatureScore: number;
}

export type A11yLabel = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

export interface AccessibleRoute {
  routeId: string;
  /** 可重算路線的導航身分。 */
  navigationId?: string;
  /** 單調遞增的路線版本；初次可重算路線為 1。 */
  routeVersion?: number;
  /** 步行路線由哪個引擎產生；大眾運輸／開車路線沒有。這是唯一穩定的分支依據（`warnings` 是文案，可能改寫）。 */
  engine?: 'pedestrian-a11y' | 'otp-fallback';
  /** 未降級時不存在，判斷要用 `=== true`。 */
  degraded?: boolean;
  warnings?: string[];
  /** 短效 bearer capability，用來啟動語音導航與 `/route/instructions`（30 分鐘 TTL）。 */
  routeToken?: string;
  routeName: string;
  totalMinutes: number;
  transferCount: number;
  legs: RouteLeg[];
  accessibilityHighlights: string[];
  accessibilityScore?: number;
  accessibilityLabel?: A11yLabel;
  scoreComponents?: ScoreComponents;
  dataConfidence?: 'high' | 'medium' | 'low';
  scoreWarnings?: string[];
  totalWalkDistanceM?: number;
  facilities?: Record<string, SlimOsmA11y>;
  attribution?: string;
  transitAlerts?: MatchedAlert[];
}

export type RouteMode = 'wheelchair' | 'elderly' | 'visual_impaired' | 'normal';
export type TravelMode = 'transit' | 'drive' | 'motorcycle' | 'walk';

export interface RouteIntent {
  from: string;
  to: string;
  mode: RouteMode;
  departureTime: string;
  preferences: {
    minimizeTransfers: boolean;
    preferElevator: boolean;
  };
}

export interface AccessibleRouteData {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  waypoints?: { lat: number; lng: number }[];
  city: string;
  travelMode?: TravelMode;
  routes: AccessibleRoute[];
  intent?: RouteIntent;
  metroAlerts?: MetroAlertResult[];
  transitAlerts?: MatchedAlert[];
}

export interface ApiCoordinate {
  latitude: number;
  longitude: number;
}

export interface AccessibleRouteRequest {
  origin?: string | ApiCoordinate;
  destination?: string | ApiCoordinate;
  waypoints?: (string | ApiCoordinate)[];
  query?: string;
  userLocation?: ApiCoordinate;
  mode?: RouteMode;
  travelMode?: TravelMode;
  maxTransfers?: number;
  departureTime?: string;
  format?: 'standard' | 'compact';
}

// --- 導航指令（/a11y/route/instructions） ---
export type NavInstructionType = 'turn' | 'transit_board' | 'transit_alight' | 'facility' | 'depart' | 'arrive';

export type RelativeDirection =
  | '正前方'
  | '左前方'
  | '右前方'
  | '左側'
  | '右側'
  | '左後方'
  | '右後方'
  | '正後方'
  | null;

export interface NavInstruction {
  text: string;
  type: NavInstructionType;
  bearing: number | null;
  relativeDirection: RelativeDirection;
  distanceM: number | null;
  streetName: string | null;
  legType: 'WALK' | 'BUS' | 'METRO' | 'THSR' | 'TRA' | 'DRIVE' | 'MOTORCYCLE';
  /** 在 route.legs 的來源索引；舊版與語音指令沒有。 */
  legIndex?: number;
  /** 本指令所屬 leg 的 `polyline` 索引（per-leg），不是串接後整條路徑的索引。 */
  polylineIndex: number | null;
}

export type NavWarning = 'WALK_STEPS_UNAVAILABLE' | 'ORS_STEPS_UNAVAILABLE' | 'ROAD_STEPS_UNAVAILABLE';

export interface NavInstructionsData {
  instructions: NavInstruction[];
  initialBearing: number;
  totalSteps: number;
  warnings: NavWarning[];
}

/** 後端只收這三個欄位，不得送整個 route 物件（SDD §6.3）。 */
export interface NavInstructionsRequest {
  routeToken: string;
  userHeading?: number;
  language?: string;
}

export type RerouteReason = 'OFF_ROUTE' | 'FACILITY_OUTAGE' | 'CONFIRMED_HAZARD' | 'TRANSIT_DISRUPTION' | 'MANUAL';

export interface AccessibleRouteRerouteRequest {
  routeToken: string;
  currentPosition: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  previousRouteVersion: number;
  reason: RerouteReason;
  clientRequestId: string;
}

/** 重算回應的完整指令清單可能叫 `instructions` 或 `steps`；呼叫端套用前先正規化。 */
export type AccessibleRouteRerouteData = {
  navigationId: string;
  previousRouteVersion: number;
  routeVersion: number;
  routeToken: string;
  route: AccessibleRoute;
  warnings: string[];
  currentStepIndex: 0;
  replayed: boolean;
} & ({ instructions: NavInstruction[]; steps?: never } | { steps: NavInstruction[]; instructions?: never });

// --- LINE 路線預覽（/line/route-preview） ---
export type RoutePreviewLegType = RouteLegType;

export interface RoutePreviewPoint {
  label: string;
  lat?: number;
  lng?: number;
}

export interface RoutePreviewDestination {
  label: string;
  lat: number;
  lng: number;
  address?: string | null;
}

export interface RoutePreviewLeg {
  type: RoutePreviewLegType;
  label?: string;
  from?: string;
  to?: string;
  durationMinutes?: number;
  durationMin?: number;
  distanceM?: number;
  departureTime?: string | null;
  arrivalTime?: string | null;
  polyline?: LngLatTuple[];
}

export interface RoutePreviewRoute {
  routeName: string;
  totalMinutes: number;
  transferCount?: number;
  accessibilityScore?: number | null;
  accessibilityLabel?: string | null;
  legs: RoutePreviewLeg[];
}

export interface RoutePreviewPageData {
  sessionId: string;
  origin: RoutePreviewPoint;
  destination: RoutePreviewDestination;
  routes: RoutePreviewRoute[];
}
