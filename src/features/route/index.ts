// RouteSessionPort（SDD §4.3）：其他 feature 只經過這些函式算路／結束路線，不直接寫 store。
export {
  applyComputedRoutes,
  computeRoute,
  endRouteSession,
  hasActiveRouteSession,
  loadRoutePreview,
  type ComputeRouteResult,
} from './controller/routeSessionPort';
export { getRouteSessionSnapshot, useRouteSession, type RouteSessionView } from './hooks/useRouteSession';
export type { SelectedRoute } from './store/routeSessionStore';

export { getRouteInstructions, rerouteAccessibleRoute } from './api/route';

export {
  hasRouteSession,
  routeResumeTarget,
  shouldShowRoutePill,
  type RouteResumeTarget,
  type SheetMode,
} from './domain/routeSession';
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
} from './domain/geo';
export {
  A11Y_FEATURE_COLOR,
  TRAFFIC_BASE_COLOR,
  TRAFFIC_LEVEL_COLORS,
  formatDuration,
  getA11yLabelColor,
  getA11yLabelText,
  getLegColor,
  plausibleSlopePercent,
  scoreToLabel,
  scoreToStars,
  visibleTrafficSegments,
} from './domain/routeDisplay';
export { ROUTE_FAILURE_I18N, type ComputeRouteParams, type RouteFailureKind } from './domain/routeRequest';

export type * from './types/route';
