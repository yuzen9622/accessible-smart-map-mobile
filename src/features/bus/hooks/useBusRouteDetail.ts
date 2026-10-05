import { useEffect, useRef, useState } from 'react';

import { appStateVisibility, createPoller } from '@/shared/polling';

import { getBusRouteDetail } from '../api/transit';
import { stripLiveEta } from '../domain/busDirections';
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
    if (!res.ok || !res.data || res.data.directions.length === 0) return { ok: false, error: 'NO_DATA' };
    return { ok: true, directions: res.data.directions };
  } catch (err) {
    return { ok: false, error: err instanceof Error && err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK' };
  }
}

/**
 * 路線詳情：進入即載入，之後每 30 秒以前景感知輪詢刷新（背景暫停、回前景立即刷新）。
 *
 * 失敗時保留靜態站序（站名、線形仍可看），但清掉舊的即時 ETA 與狀態，並標示 error——不把上一輪的倒數
 * 當成本輪成功。資料連同它屬於哪條路線一起存；換路線的第一個 render 不會回傳另一條路線的站序，
 * 換參數後才完成的舊請求（輪詢或手動更新）也不會寫入。
 */
export function useBusRouteDetail(routeName: string, city: string): BusRouteDetailState {
  const key = `${city}::${routeName}`;
  const [state, setState] = useState<{ key: string; directions: RouteDetailDirection[]; loading: boolean; error: BusSearchError | null }>({
    key,
    directions: [],
    loading: true,
    error: null,
  });
  // 下拉更新中屬於哪條路線：換路線後舊的更新就算還沒回來，也不會讓新路線一直轉圈。
  const [refreshingKey, setRefreshingKey] = useState<string | null>(null);
  const generation = useRef(0);
  // 輪詢與手動刷新共用 request 世代：同一目標也只接受最後開始的請求。
  const requests = useRef(0);
  const manual = useRef<AbortController | null>(null);

  useEffect(() => {
    const mine = ++generation.current;
    const poller = createPoller({
      intervalMs: ROUTE_DETAIL_REFRESH_MS,
      visibility: appStateVisibility,
      task: async ({ signal }) => {
        const request = ++requests.current;
        if (manual.current) {
          manual.current.abort();
          manual.current = null;
          setRefreshingKey(null);
        }
        const result = await fetchDirections(routeName, city, signal);
        if (signal.aborted || generation.current !== mine || requests.current !== request) return;
        setState((prev) => applyResult(prev, key, result));
      },
    });
    poller.start();
    return () => {
      generation.current += 1;
      manual.current?.abort();
      poller.stop();
    };
  }, [routeName, city, key]);

  const refresh = async () => {
    const mine = generation.current;
    const request = ++requests.current;
    manual.current?.abort();
    const controller = new AbortController();
    manual.current = controller;
    setRefreshingKey(key);
    const result = await fetchDirections(routeName, city, controller.signal);
    if (manual.current === controller && generation.current === mine) {
      manual.current = null;
      setRefreshingKey(null);
    }
    if (controller.signal.aborted || generation.current !== mine || requests.current !== request) return;
    setState((prev) => applyResult(prev, key, result));
  };

  const current = state.key === key ? state : { key, directions: [], loading: true, error: null };
  return { directions: current.directions, loading: current.loading, refreshing: refreshingKey === key, error: current.error, refresh };
}

type FetchResult = Awaited<ReturnType<typeof fetchDirections>>;

function applyResult(
  prev: { key: string; directions: RouteDetailDirection[]; loading: boolean; error: BusSearchError | null },
  key: string,
  result: FetchResult,
) {
  const base = prev.key === key ? prev.directions : [];
  if (result.ok) return { key, directions: result.directions, loading: false, error: null };
  return { key, directions: stripLiveEta(base), loading: false, error: result.error };
}
