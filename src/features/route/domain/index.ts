// route 的「純邏輯」公開出口（SDD §4.1 規則 3 的補充）：其他 feature 的 domain 層只能 import 這裡，
// 不能 import `@/features/route`（那個出口會帶進 controller → map → 原生模組，domain 就不能在 node 下測）。
// 本檔與其下所有模組都不得 import react-native／expo。
export { hasRouteSession, routeResumeTarget, sheetModeFromPath, shouldShowRoutePill, type RouteResumeTarget, type SheetMode } from './routeSession';
export {
  bearingDeg,
  buildCumulativePath,
  filterIncidentsAlongRoute,
  normalizeDeg,
  pointToPolylineDistanceM,
  projectToPath,
  resolveWaypoints,
  shortestAngleLerp,
  type CumulativePath,
  type Projection,
  type Waypoint,
} from './geo';
export {
  A11Y_FEATURE_COLOR,
  TRAFFIC_BASE_COLOR,
  TRAFFIC_LEVEL_COLORS,
  formatDuration,
  getA11yLabelColor,
  getA11yLabelText,
  getLegColor,
  LEG_LABEL_FILL,
  plausibleSlopePercent,
  pointLabel,
  scoreToLabel,
  scoreToStars,
  visibleTrafficSegments,
} from './routeDisplay';
export { ROUTE_FAILURE_I18N, type ComputeRouteParams, type RouteFailureKind } from './routeRequest';
export type * from '../types/route';
export {
  A11Y_FEATURE_LABEL_KEY,
  A11Y_FEATURE_ORDER,
  LABEL_TO_SCORE,
  dedupeA11yCategories,
  gradeSlope,
  gradeUnconfirmedCrossings,
  gradeWidth,
  walkA11yMetrics,
  type A11yGrade,
  type WalkA11yMetrics,
  driveLegMinutes,
  effectiveAccessibilityScore,
  getConfidenceLabelKey,
  getRouteAlertsCount,
  routeSummary,
  shouldAppendExitNumber,
  walkStepText,
  type Translate,
} from './routeCard';
export {
  INCIDENT_ADVISORY_COLOR,
  INCIDENT_CLOSURE_COLOR,
  ROUTE_DESTINATION_COLOR,
  ROUTE_ORIGIN_COLOR,
  ROUTE_WAYPOINT_COLOR,
  buildRouteLayerData,
  type RouteLayerData,
  type RouteLineKind,
  type RouteLineProps,
  type RoutePointKind,
  type RoutePointProps,
} from './routeLayerData';
export {
  ROUTE_MODES,
  ROUTE_MODE_LABEL_KEY,
  TRAVEL_MODES,
  effectiveTravelMode,
  hasGatedTravelModes,
  isTravelModeAllowed,
} from './travelModes';
