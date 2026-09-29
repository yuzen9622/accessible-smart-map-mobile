import { useEffect, useRef, useState } from 'react';

import { hasMovedBeyond, type LatLng } from '@/shared/geo';

import { getNearbyBusStops } from '../api/transit';
import type { BusSearchError } from './useBusSearch';
import type { BusStopSearchResult } from '../types/transit';

export interface NearbyBusStopsState {
  stops: BusStopSearchResult[];
  loading: boolean;
  error: BusSearchError | null;
}

/**
 * 附近站牌：位置與上次查詢相距 ≥ 100 m 才重新查（定位每秒抖動不重打 API）。
 * `enabled` 為 false（使用者正在搜尋）時不查，也不取消已回來的結果。
 */
export function useNearbyBusStops(position: LatLng | null, enabled: boolean): NearbyBusStopsState {
  const [state, setState] = useState<NearbyBusStopsState>({ stops: [], loading: false, error: null });
  const lastFetched = useRef<LatLng | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !position) return;
    if (!hasMovedBeyond(lastFetched.current, position)) return;
    lastFetched.current = position;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const run = async () => {
      try {
        const res = await getNearbyBusStops(position, current.signal);
        if (current.signal.aborted) return;
        setState({ stops: res.data?.stops ?? [], loading: false, error: res.data ? null : 'NO_DATA' });
      } catch (err) {
        if (current.signal.aborted) return;
        // 失敗時允許下一次定位更新重試。
        lastFetched.current = null;
        setState((prev) => ({ ...prev, loading: false, error: err instanceof Error && err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK' }));
      }
    };
    void run();
  }, [position, enabled]);

  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );

  return state;
}
