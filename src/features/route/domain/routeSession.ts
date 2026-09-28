// 移植自 Web `src/lib/route/routeSession.ts`（commit 5eadc71），邏輯逐行保留。
// 差異：Web 的 `SheetMode` 是 store 裡的一份狀態；本 App 的 sheet 狀態由 Expo Router
// 目前的 sheet 路由推導（SDD §4.5），所以這裡只宣告判斷需要的面板種類，呼叫端負責從路由換算。

/**
 * 「路線 session」是使用者規劃路線時累積的一切：選的目的地、回傳的路線、選中的那條。
 * 它刻意**不等於**「目前開著哪個面板」。
 *
 * 本檔要守住的不變量：
 *
 *   路線幾何在地圖上  ⟺  畫面上有一個能回到它、也能結束它的常駐控制。
 *
 * 切換面板不會毀掉任何東西；結束 session 是明確動作，只在一個地方發生
 * （`routeSessionStore.endRouteSession`）。Web 版曾有四份手寫的清除清單，
 * 每份都漏了 origin／destination，導致「面板關了、線沒了、pin 還在」。
 */
export interface RouteSessionSnapshot {
  computeRoutes: unknown[] | null;
  selectRoute: unknown | null;
  destination: unknown | null;
}

/**
 * 地圖上還有任何路線相關的東西就為 true。
 *
 * 只有 `destination` 也算：選了目的地但在路線回來前退出，地圖上仍有 pin，
 * 這個 pin 需要和完整結果一樣的出口。`destination` 只會由路線規劃入口寫入，
 * 一般搜尋不會寫，所以不會誤觸發。
 */
export function hasRouteSession(snapshot: RouteSessionSnapshot): boolean {
  return snapshot.computeRoutes !== null || snapshot.selectRoute !== null || snapshot.destination !== null;
}

/** 面板種類（對應 Web `SheetMode`）。本 App 由目前的 sheet 路由換算而來。 */
export type SheetMode = 'home' | 'place' | 'plan' | 'route' | 'navigation' | 'station';

export type RouteResumeTarget = Extract<SheetMode, 'plan' | 'route'>;

/**
 * 「回到路線」要落在哪裡：有結果 → 使用者上次看的路線比較清單；只有目的地 →
 * 規劃表單（起訖點保持已填）。
 */
export function routeResumeTarget(computeRoutes: unknown[] | null): RouteResumeTarget {
  return computeRoutes && computeRoutes.length > 0 ? 'route' : 'plan';
}

/**
 * 決定「回到路線」pill 是否顯示的唯一判斷——pill 本身與測試都 import 這一個，
 * 不讓任何畫面算出另一個不一致的答案。
 *
 * 使用者已在路線流程內（`plan`／`route`）時隱藏；導航中也隱藏，HUD 就是路線在畫面上的存在。
 *
 * `chatOpen` 會覆蓋路線流程的例外：AI 助理蓋在面板上時 `sheetMode` 仍是 "route"，
 * 但路線面板根本不在畫面上，這正是 pill 要補的洞。
 */
export function shouldShowRoutePill(args: {
  hasSession: boolean;
  sheetMode: SheetMode;
  isNavigating: boolean;
  chatOpen: boolean;
}): boolean {
  if (!args.hasSession || args.isNavigating) return false;
  if (args.chatOpen) return true;
  return args.sheetMode !== 'plan' && args.sheetMode !== 'route' && args.sheetMode !== 'navigation';
}
