// 移植自 Web `src/lib/ai/uiAction.ts`（commit f5027af）。SheetMode 改自 route domain；AiResultMarker 改為原生的 `AiMarker`
// （Web 的 `target` 帶 PlaceResult／Marker 物件供開面板，原生由呼叫端依 `kind`／`googlePlaceId` 開對應畫面）。
import type { AccessibleRoute, AiRoutePlan, SheetMode } from '@/features/route/domain';
import type { LatLng } from '@/shared/geo';

export type { LatLng };

export type AiMarkerKind = 'elevator' | 'ramp' | 'restroom' | 'facility' | 'place';

/** AI 工具結果在地圖與聊天卡片上的可點標記。 */
export interface AiMarker {
  id: string;
  position: LatLng;
  title: string;
  subtitle?: string;
  kind: AiMarkerKind;
  /** `kind === 'place'`（findGooglePlaces）才有：Google place id，開地點詳情用。 */
  googlePlaceId?: string;
  placeType?: string;
  rating?: number;
}

// ── Map ──

interface ShowMarkersAction {
  type: 'show-markers';
  markers: AiMarker[];
}

interface ClearMarkersAction {
  type: 'clear-markers';
}

interface FlyToAction {
  type: 'fly-to';
  position: LatLng;
  zoom?: number;
}

// ── Route ──

interface ShowRouteAction {
  type: 'show-route';
  plan?: AiRoutePlan;
  origin: LatLng;
  destination: LatLng;
  routes: AccessibleRoute[];
}

// ── Panel ──

interface SwitchPanelAction {
  type: 'switch-panel';
  sheet: SheetMode;
}

interface CloseChatAction {
  type: 'close-chat';
}

// ── Union ──

export type UIAction =
  | { type: 'route-error' }
  | ShowMarkersAction
  | ClearMarkersAction
  | FlyToAction
  | ShowRouteAction
  | SwitchPanelAction
  | CloseChatAction;

export interface ActionResult {
  ok: boolean;
  skipped?: string;
}
