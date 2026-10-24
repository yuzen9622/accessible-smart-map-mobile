// RouteSessionPort（SDD §4.3）：其他 feature 只經過這些函式算路／結束路線，不直接寫 store。
export {
  applyComputedRoutes,
  applyAiRoutePlan,
  getRouteConversationInput,
  invalidateRouteConversations,
  pinNavigationRoute,
  clearNavigationRoute,
  markRouteTokenInvalid,
  canNavigateRoute,
  replaceNavigationRoute,
  computeRoute,
  endRouteSession,
  hasActiveRouteSession,
  loadRoutePreview,
  fitSelectedRoute,
  replaceSelectedRoute,
  selectRouteAt,
  previewLegGeometry,
  type ComputeRouteResult,
} from './controller/routeSessionPort';
export {
  getRouteSessionSnapshot,
  subscribeRouteSession,
  useRouteSession,
  type RouteSessionView,
} from './hooks/useRouteSession';
export type { LegGeometryPreview, SelectedRoute } from './store/routeSessionStore';

export { getRouteInstructions, rerouteAccessibleRoute } from './api/route';

// 純邏輯（型別、geo、顯示 helper）；其他 feature 的 domain 層請直接從 `@/features/route/domain` 引用。
export * from './domain';

// UI（Phase 2）：面板、地圖圖層、pill。跨 feature 的依賴（開始導航、公車 leg）由 app 路由組裝注入。
export { default as RoutePlanScreen } from './screens/RoutePlanScreen';
export { default as RouteLocationSearchScreen } from './screens/RouteLocationSearchScreen';
export { default as RouteDetailScreen, type BusLegRenderArgs, type RouteDetailScreenProps } from './screens/RouteDetailScreen';
export { default as RouteLayer } from './components/RouteLayer';
export { default as RouteFacilityLayer } from './components/RouteFacilityLayer';
export { default as RouteSessionPill, type RouteSessionPillProps } from './components/RouteSessionPill';
