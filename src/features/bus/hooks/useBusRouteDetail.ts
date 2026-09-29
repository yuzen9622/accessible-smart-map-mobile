import { useEffect, useRef, useState } from 'react';

import { appStateVisibility, createPoller } from '@/shared/polling';

import { getBusRouteDetail } from '../api/transit';
import type { RouteDetailDirection } from '../types/transit';
import type { BusSearchError } from './useBusSearch';

export const ROUTE_DETAIL_REFRESH_MS = 30_000;

export interface BusRouteDetailState {
  directions: RouteDetailDirection[];
  /** 第一次載入（還沒有任何資料）。 */
  loading: boolean;
  /** 下拉更新中。 */
  refreshing: boolean;
  error: BusSearchError | null;
  refresh: () => Promise<void>;
}

async function fetchDirections(
  routeName: string,
  city: string,
  signal?: AbortSignal,
): Promise<{ ok: true; directions: RouteDetailDirection[] } | { ok: false; error: BusSearchError }> {
  try {
    const res = await getBusRouteDetail(routeName, city, signal);
    if (!res.data || res.data.directions.length === 0) return { ok: false, error: 'NO_DATA' };
    return { ok: true, directions: res.data.directions };
  } catch (err) {
    return { ok: false, error: err instanceof Error && err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK' };
  }
}

/**
 * 路線詳情：進入即載入，之後每 30 秒以前景感知輪詢刷新（背景暫停、回前景立即刷新）。
 * 輪詢失敗保留上一份好資料；只有完全沒資料時才顯示錯誤。每個畫面實例對應一條路線（換路線是 push 新畫面），不處理參數原地變更。
 */
export function useBusRouteDetail(routeName: string, city: string): BusRouteDetailState {
  const [directions, setDirections] = useState<RouteDetailDirection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<BusSearchError | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const poller = createPoller({
      intervalMs: ROUTE_DETAIL_REFRESH_MS,
      visibility: appStateVisibility,
      task: async ({ signal }) => {
        const result = await fetchDirections(routeName, city, signal);
        if (signal.aborted) return;
        setLoading(false);
        if (result.ok) {
          setDirections(result.directions);
          setError(null);
        } else {
          // 已有資料時保留舊資料（對齊輪詢的「暫時性失敗」語意）。
          setError(result.error);
        }
      },
    });
    poller.start();
    return () => {
      alive.current = false;
      poller.stop();
    };
  }, [routeName, city]);

  const refresh = async () => {
    setRefreshing(true);
    const result = await fetchDirections(routeName, city);
    if (!alive.current) return;
    setRefreshing(false);
    setLoading(false);
    if (result.ok) {
      setDirections(result.directions);
      setError(null);
    } else {
      setError(result.error);
    }
  };

  return { directions, loading, refreshing, error, refresh };
}
