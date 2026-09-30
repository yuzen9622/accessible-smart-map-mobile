import { useEffect, useRef, useState } from 'react';

import { ApiError } from '@/shared/api';
import type { LatLng } from '@/shared/geo';
import { appStateVisibility, createPoller } from '@/shared/polling';

import { getStopArrivals } from '../api/transit';
import type { StopArrival } from '../types/transit';

export const STOP_ARRIVALS_REFRESH_MS = 30_000;

/**
 * - `unavailable`：後端沒有這個站牌的到站資料（404，含尚未部署 `/bus/stop-arrivals` 的舊後端）→ 只列路線名稱。
 * - `error`：網路或伺服器錯誤且手上沒有任何資料。
 */
export type StopArrivalsStatus = 'loading' | 'ready' | 'unavailable' | 'error';

export interface StopArrivalsState {
  status: StopArrivalsStatus;
  arrivals: StopArrival[];
  refreshing: boolean;
  refresh: () => Promise<void>;
}

type FetchResult = { ok: true; arrivals: StopArrival[] } | { ok: false; unavailable: boolean };

async function fetchArrivals(stopName: string, city: string, position: LatLng, signal?: AbortSignal): Promise<FetchResult> {
  try {
    const res = await getStopArrivals({ stopName, city, position }, signal);
    if (!res.data) return { ok: false, unavailable: false };
    return { ok: true, arrivals: res.data.arrivals };
  } catch (error) {
    return { ok: false, unavailable: error instanceof ApiError && error.code === 404 };
  }
}

/**
 * 站牌上所有行經路線的下一班（設計 2b「站牌（下一班優先）」）：每輪只打一支 `/bus/stop-arrivals`。
 * 每 30 秒前景感知輪詢；`active` 為 false（畫面失焦，例如推入路線詳情）時停止。輪詢失敗保留上一份資料。
 */
export function useStopArrivals(stopName: string, city: string, position: LatLng | null, active: boolean): StopArrivalsState {
  const [state, setState] = useState<{ status: StopArrivalsStatus; arrivals: StopArrival[] }>({
    status: position ? 'loading' : 'unavailable',
    arrivals: [],
  });
  const [refreshing, setRefreshing] = useState(false);
  const alive = useRef(true);
  const lat = position?.lat ?? null;
  const lng = position?.lng ?? null;

  const apply = (result: FetchResult) =>
    setState((prev) => {
      if (result.ok) return { status: 'ready', arrivals: result.arrivals };
      if (result.unavailable) return { status: 'unavailable', arrivals: [] };
      // 暫時性失敗：已有資料就保留。
      return prev.status === 'ready' ? prev : { status: 'error', arrivals: [] };
    });

  useEffect(() => {
    alive.current = true;
    if (!active || lat === null || lng === null || !stopName) return;
    const poller = createPoller({
      intervalMs: STOP_ARRIVALS_REFRESH_MS,
      visibility: appStateVisibility,
      task: async ({ signal }) => {
        const result = await fetchArrivals(stopName, city, { lat, lng }, signal);
        if (!signal.aborted) apply(result);
      },
    });
    poller.start();
    return () => {
      alive.current = false;
      poller.stop();
    };
  }, [stopName, city, lat, lng, active]);

  const refresh = async () => {
    if (lat === null || lng === null) return;
    setRefreshing(true);
    const result = await fetchArrivals(stopName, city, { lat, lng });
    if (!alive.current) return;
    setRefreshing(false);
    apply(result);
  };

  return { status: state.status, arrivals: state.arrivals, refreshing, refresh };
}
