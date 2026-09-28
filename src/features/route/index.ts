// RouteSessionPort（SDD §4.3）：其他 feature 只經過這些函式算路／結束路線，不直接寫 store。
export {
  applyComputedRoutes,
  computeRoute,
  endRouteSession,
  hasActiveRouteSession,
  loadRoutePreview,
  replaceSelectedRoute,
  type ComputeRouteResult,
} from './controller/routeSessionPort';
export {
  getRouteSessionSnapshot,
  subscribeRouteSession,
  useRouteSession,
  type RouteSessionView,
} from './hooks/useRouteSession';
export type { SelectedRoute } from './store/routeSessionStore';

export { getRouteInstructions, rerouteAccessibleRoute } from './api/route';

// 純邏輯（型別、geo、顯示 helper）；其他 feature 的 domain 層請直接從 `@/features/route/domain` 引用。
export * from './domain';
