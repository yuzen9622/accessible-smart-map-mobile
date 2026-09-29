import { create } from 'zustand';

import { mapCamera } from '@/features/map';
import { ApiError } from '@/shared/api';

import { getPublicSosSession } from '../api/sosApi';
import type { SosPublicSession } from '../domain/types';

/**
 * 家人端的即時求助追蹤，對齊 Web `SosTrackerWrapper.tsx`（commit f82cda8）：
 * 不需登入；每 10 秒輪詢 `GET /sessions/:token/public`；404 → 找不到、410 → 連結已失效、resolved → 已解除；
 * 已在追蹤中時暫時失敗不打斷畫面（保留最後一筆）；第一次載入才把地圖飛過去（zoom 17）。
 * 差異：Web 以 `?sos=` 開啟並靠 sessionId；原生以深層連結 `sos-track/<shareToken>` 開啟（後端已改以 shareToken 為 key）。
 */

export const TRACKER_POLL_MS = 10000;
const TRACKER_ZOOM = 17;

export type TrackerPhase = 'none' | 'loading' | 'active' | 'resolved' | 'notFound' | 'expired' | 'error';

interface TrackerState {
  token: string | null;
  phase: TrackerPhase;
  session: SosPublicSession | null;
}

export const useSosTrackerStore = create<TrackerState>(() => ({ token: null, phase: 'none', session: null }));

let timer: ReturnType<typeof setInterval> | null = null;
let controller: AbortController | null = null;
let centered = false;

function stopPolling(): void {
  if (timer) clearInterval(timer);
  timer = null;
  controller?.abort();
  controller = null;
}

async function tick(token: string): Promise<void> {
  const current = new AbortController();
  controller?.abort();
  controller = current;
  try {
    const session = await getPublicSosSession(token, current.signal);
    if (current.signal.aborted || useSosTrackerStore.getState().token !== token) return;
    if (!session) {
      useSosTrackerStore.setState((s) => ({ phase: s.phase === 'loading' ? 'error' : s.phase }));
      return;
    }
    if (session.status === 'resolved') {
      stopPolling();
      useSosTrackerStore.setState({ phase: 'resolved', session: null });
      return;
    }
    useSosTrackerStore.setState({ phase: 'active', session });
    if (!centered) {
      centered = true;
      mapCamera.flyTo([session.lng, session.lat], TRACKER_ZOOM);
    }
  } catch (error) {
    if (current.signal.aborted) return;
    if (error instanceof ApiError && (error.code === 404 || error.code === 410)) {
      stopPolling();
      useSosTrackerStore.setState({ phase: error.code === 404 ? 'notFound' : 'expired', session: null });
      return;
    }
    // 暫時性失敗：還在載入就顯示錯誤；已在追蹤中則保留最後一筆資料
    useSosTrackerStore.setState((s) => ({ phase: s.phase === 'loading' ? 'error' : s.phase }));
  }
}

export function openSosTracker(token: string): void {
  if (useSosTrackerStore.getState().token === token && timer) return;
  stopPolling();
  centered = false;
  useSosTrackerStore.setState({ token, phase: 'loading', session: null });
  void tick(token);
  timer = setInterval(() => void tick(token), TRACKER_POLL_MS);
}

export function closeSosTracker(): void {
  stopPolling();
  useSosTrackerStore.setState({ token: null, phase: 'none', session: null });
}

export function centerOnRequester(): void {
  const session = useSosTrackerStore.getState().session;
  if (session) mapCamera.flyTo([session.lng, session.lat], TRACKER_ZOOM);
}
