import { useRouteSessionStore, type RouteSessionState } from '../store/routeSessionStore';

/** 唯讀的狀態欄位；寫入一律經過 `RouteSessionPort`（`computeRoute`／`endRouteSession` 等）。 */
export type RouteSessionView = Omit<
  RouteSessionState,
  'setOrigin' | 'setDestination' | 'swapEndpoints' | 'selectRouteIndex' | 'endRouteSession' | 'requestSeq'
>;

/**
 * 其他 feature 讀路線 session 的唯一入口（SDD §4.1 規則 3：只經公開 API，不直接寫別人的 store）。
 * selector 回傳物件時請搭配 `zustand/react/shallow` 的 `useShallow`，避免每次 render 都換參照。
 */
export function useRouteSession<T>(selector: (state: RouteSessionView) => T): T {
  return useRouteSessionStore(selector);
}

/** 非 React 呼叫端（AI／語音 action、導航控制器）用的同步快照。 */
export function getRouteSessionSnapshot(): RouteSessionView {
  return useRouteSessionStore.getState();
}
