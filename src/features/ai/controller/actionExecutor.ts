import { router } from 'expo-router';

import { mapCamera } from '@/features/map';
import { applyAiRoutePlan, applyComputedRoutes, fitSelectedRoute } from '@/features/route';
import type { LatLng } from '@/shared/geo';

import type { ToolResultItem } from '../domain/toolResultCards';
import type { ActionResult, AiMarker, UIAction } from '../domain/uiAction';
import { useAiResultStore } from '../store/aiResultStore';

/**
 * AI UI action 的執行者（對應 Web `src/lib/ai/actionExecutor.ts`）：只經過 port（`mapCamera`、`RouteSessionPort`、
 * Expo Router）改畫面，不碰別的 feature 的 store（SDD §4.3）。聊天與語音共用這一份（§6.6 雙路徑）。
 *
 * AI 結果只套用後端路線；手動規劃由 route feature 負責。
 */

const MARKER_EDGE = { top: 80, left: 48, right: 48 };
/** 單點時 fitBounds 會縮到最大，改用固定縮放。 */
const SINGLE_MARKER_ZOOM = 16;

function lngLat(point: LatLng): [number, number] {
  return [point.lng, point.lat];
}

function fitMarkers(markers: AiMarker[]): void {
  if (markers.length === 0) return;
  if (markers.length === 1) {
    mapCamera.flyTo(lngLat(markers[0].position), SINGLE_MARKER_ZOOM);
    return;
  }
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const { position } of markers) {
    west = Math.min(west, position.lng);
    east = Math.max(east, position.lng);
    south = Math.min(south, position.lat);
    north = Math.max(north, position.lat);
  }
  mapCamera.fitBounds([west, south, east, north], MARKER_EDGE);
}

/** 開著的聊天畫面登記的「關掉自己」；沒登記＝聊天沒開（語音路徑）。 */
let dismissChatScreen: (() => void) | null = null;

export function registerChatDismiss(dismiss: () => void): () => void {
  dismissChatScreen = dismiss;
  return () => {
    if (dismissChatScreen === dismiss) dismissChatScreen = null;
  };
}

/**
 * 關掉聊天 modal；聊天沒開時不動。不能用 `router.canDismiss()`＋`dismiss()`：root stack 底下永遠有
 * 首頁 sheet，canDismiss 恆為 true，聊天沒開時會改成退掉 sheet 面板（或整個首頁 sheet）。
 */
export function closeChat(): void {
  dismissChatScreen?.();
}

export function openRoutePanel(): void {
  closeChat();
  router.navigate('/routes');
}

export function executeAction(action: UIAction): ActionResult {
  switch (action.type) {
    case 'show-markers':
      useAiResultStore.getState().setMarkers(action.markers);
      fitMarkers(action.markers);
      return { ok: true };
    case 'clear-markers':
      useAiResultStore.getState().clear();
      return { ok: true };
    case 'fly-to':
      mapCamera.flyTo(lngLat(action.position), action.zoom ?? 17);
      return { ok: true };
    case 'route-error':
      return { ok: false, skipped: 'invalid-route-plan' };
    case 'show-route':
      if (action.plan) applyAiRoutePlan(action.plan);
      else applyComputedRoutes(action.origin, action.destination, action.routes);
      fitSelectedRoute();
      openRoutePanel();
      return { ok: true };
    case 'switch-panel':
      // 目前 mapper 只會要求切到路線面板；其他面板由各自的 action 自己開
      if (action.sheet === 'route') openRoutePanel();
      return { ok: true };
    case 'close-chat':
      closeChat();
      return { ok: true };
  }
}

/**
 * 點結果卡（對應 Web `useOpenAiResult`）：Google 地點開地點詳情，其他有座標的飛過去並把該點畫在地圖上；
 * 兩者都關掉聊天讓使用者看到地圖。
 */
export function openAiResult(item: ToolResultItem): void {
  const marker = item.marker;
  const position = marker?.position ?? item.position ?? null;
  if (!position) return;
  closeChat();
  if (marker) useAiResultStore.getState().setMarkers([marker]);
  mapCamera.flyTo(lngLat(position), 17);
  if (marker?.kind === 'place' && marker.googlePlaceId) {
    const id = marker.googlePlaceId.startsWith('google:') ? marker.googlePlaceId : `google:${marker.googlePlaceId}`;
    router.navigate({ pathname: '/place/[id]', params: { id } });
  }
}
