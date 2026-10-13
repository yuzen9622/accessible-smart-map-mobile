import { create } from 'zustand';

import { mapCamera } from '@/features/map';
import { ApiError } from '@/shared/api';

import { getPublicSosSession } from '../api/sosApi';
import { isTrackableSosPublicSession, type TrackableSosPublicSession } from '../domain/types';

/**
 * 家人端的即時求助追蹤，對齊 Web `SosTrackerWrapper.tsx`（commit f82cda8）：
 * 不需登入；每 10 秒輪詢 `GET /sessions/:token/public`；404 → 找不到、410 → 連結已失效、resolved → 已解除；
 * 429 退避後重試；已在追蹤中時暫時失敗不打斷畫面（保留最後一筆）；第一次載入才把地圖飛過去（zoom 17）。
 * Web 與原生都以 shareToken 查詢；公開回應 resolved 時刻意沒有座標。
 */

export const TRACKER_POLL_MS = 10000;
export const TRACKER_RATE_LIMIT_RETRY_MS = 30000;
const TRACKER_ZOOM = 17;

export type TrackerPhase = 'none' | 'loading' | 'active' | 'resolved' | 'notFound' | 'expired' | 'error';

interface TrackerState {
  token: string | null;
  phase: TrackerPhase;
  session: TrackableSosPublicSession | null;
}

export const useSosTrackerStore = create<TrackerState>(() => ({ token: null, phase: 'none', session: null }));

let timer: ReturnType<typeof setTimeout> | null = null;
let controller: AbortController | null = null;
let centered = false;

function stopPolling(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  controller?.abort();
  controller = null;
}

async function tick(token: string): Promise<void> {
  const current = new AbortController();
  controller?.abort();
  controller = current;
  let keepPolling = true;
  let nextDelay = TRACKER_POLL_MS;
  try {
    const session = await getPublicSosSession(token, current.signal);
    if (current.signal.aborted || useSosTrackerStore.getState().token !== token) {
      keepPolling = false;
      return;
    }
    if (!session) {
      useSosTrackerStore.setState((s) => ({ phase: s.phase === 'loading' ? 'error' : s.phase }));
      return;
    }
    // Resolved responses intentionally omit coordinates, so never store them
    // in state that drives the map layer or camera.
    if (session.status === 'resolved') {
      keepPolling = false;
      stopPolling();
      useSosTrackerStore.setState({ phase: 'resolved', session: null });
      return;
    }
    if (!isTrackableSosPublicSession(session)) {
      useSosTrackerStore.setState((s) => ({ phase: s.phase === 'loading' ? 'error' : s.phase }));
      return;
    }
    useSosTrackerStore.setState({ phase: 'active', session });
    if (!centered) {
      centered = true;
      mapCamera.flyTo([session.lng, session.lat], TRACKER_ZOOM);
    }
  } catch (error) {
    if (current.signal.aborted) {
      keepPolling = false;
      return;
    }
    if (error instanceof ApiError && (error.code === 404 || error.code === 410)) {
      keepPolling = false;
      stopPolling();
      useSosTrackerStore.setState({ phase: error.code === 404 ? 'notFound' : 'expired', session: null });
      return;
    }
    if (error instanceof ApiError && error.code === 429) {
      nextDelay = TRACKER_RATE_LIMIT_RETRY_MS;
      return;
    }
    // 暫時性失敗：還在載入就顯示錯誤；已在追蹤中則保留最後一筆資料
    useSosTrackerStore.setState((s) => ({ phase: s.phase === 'loading' ? 'error' : s.phase }));
  } finally {
    if (controller === current) controller = null;
    if (keepPolling && useSosTrackerStore.getState().token === token && !current.signal.aborted) {
      timer = setTimeout(() => {
        timer = null;
        void tick(token);
      }, nextDelay);
    }
  }
}

export function openSosTracker(token: string): void {
  if (useSosTrackerStore.getState().token === token && (timer || controller)) return;
  stopPolling();
  centered = false;
  useSosTrackerStore.setState({ token, phase: 'loading', session: null });
  void tick(token);
}

export function closeSosTracker(): void {
  stopPolling();
  useSosTrackerStore.setState({ token: null, phase: 'none', session: null });
}

export function centerOnRequester(): void {
  const session = useSosTrackerStore.getState().session;
  if (session) mapCamera.flyTo([session.lng, session.lat], TRACKER_ZOOM);
}

/** 載入失敗後的「重新嘗試」：重開輪詢並重新置中。 */
export function retrySosTracker(): void {
  const token = useSosTrackerStore.getState().token;
  if (!token) return;
  stopPolling();
  centered = false;
  useSosTrackerStore.setState({ phase: 'loading', session: null });
  void tick(token);
}
