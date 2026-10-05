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
    if (!res.ok || !res.data) return { ok: false, unavailable: false };
    return { ok: true, arrivals: res.data.arrivals };
  } catch (error) {
    return { ok: false, unavailable: error instanceof ApiError && error.code === 404 };
  }
}

function toState(key: string, result: FetchResult): { key: string; status: StopArrivalsStatus; arrivals: StopArrival[] } {
  if (result.ok) return { key, status: 'ready', arrivals: result.arrivals };
  return { key, status: result.unavailable ? 'unavailable' : 'error', arrivals: [] };
}

/**
 * 站牌上所有行經路線的下一班（設計 2b「站牌（下一班優先）」）：每輪只打一支 `/bus/stop-arrivals`。
 * 每 30 秒前景感知輪詢；`active` 為 false（畫面失焦，例如推入路線詳情）時停止。
 *
 * 查詢失敗就是 `error`（或 `unavailable`），並清掉到站資料：上一輪的 ETA、車牌不能冒充本輪成功。
 * 資料連同它屬於哪個站牌一起存，換站牌後才完成的舊請求（輪詢或手動更新）不會寫入。
 */
export function useStopArrivals(stopName: string, city: string, position: LatLng | null, active: boolean): StopArrivalsState {
  const lat = position?.lat ?? null;
  const lng = position?.lng ?? null;
  const key = `${city}::${stopName}::${lat ?? ''},${lng ?? ''}`;
  const initial = (forKey: string): { key: string; status: StopArrivalsStatus; arrivals: StopArrival[] } => ({
    key: forKey,
    status: position ? 'loading' : 'unavailable',
    arrivals: [],
  });
  const [state, setState] = useState(() => initial(key));
  const [refreshingKey, setRefreshingKey] = useState<string | null>(null);
  const generation = useRef(0);
  const requests = useRef(0);
  const manual = useRef<AbortController | null>(null);

  useEffect(() => {
    const mine = ++generation.current;
    if (!active || lat === null || lng === null || !stopName) return;
    const poller = createPoller({
      intervalMs: STOP_ARRIVALS_REFRESH_MS,
      visibility: appStateVisibility,
      task: async ({ signal }) => {
        const request = ++requests.current;
        if (manual.current) {
          manual.current.abort();
          manual.current = null;
          setRefreshingKey(null);
        }
        const result = await fetchArrivals(stopName, city, { lat, lng }, signal);
        if (!signal.aborted && generation.current === mine && requests.current === request) setState(toState(key, result));
      },
    });
    poller.start();
    return () => {
      generation.current += 1;
      manual.current?.abort();
      poller.stop();
    };
  }, [stopName, city, lat, lng, active, key]);

  const refresh = async () => {
    if (lat === null || lng === null) return;
    const mine = generation.current;
    const request = ++requests.current;
    manual.current?.abort();
    const controller = new AbortController();
    manual.current = controller;
    setRefreshingKey(key);
    const result = await fetchArrivals(stopName, city, { lat, lng }, controller.signal);
    if (manual.current === controller && generation.current === mine) {
      manual.current = null;
      setRefreshingKey(null);
    }
    if (controller.signal.aborted || generation.current !== mine || requests.current !== request) return;
    setState(toState(key, result));
  };

  const current = state.key === key ? state : initial(key);
  return { status: current.status, arrivals: current.arrivals, refreshing: refreshingKey === key, refresh };
}
