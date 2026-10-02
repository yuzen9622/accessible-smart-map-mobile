import { useEffect, useState } from 'react';

import { logger } from '@/shared/logger';
import { appStateVisibility, createPoller } from '@/shared/polling';

import { getLiveBusPositions } from '../api/transit';
import type { LiveBus } from '../types/transit';
import { ROUTE_DETAIL_REFRESH_MS } from './useBusRouteDetail';

export interface RouteLiveBuses {
  buses: LiveBus[];
  /** 這個方向的第一次查詢已經回來（成功或失敗都算）。 */
  settled: boolean;
}

/**
 * 路線詳情用：某方向所有車輛的即時位置，與站序同樣每 30 秒更新。
 * 失敗時保留上一份位置（車子畫在舊位置比整條線上的車突然消失好理解）。
 */
export function useRouteLiveBuses(routeName: string, city: string, direction: 0 | 1 | null): RouteLiveBuses {
  const [state, setState] = useState<{ key: string; buses: LiveBus[] }>({ key: '', buses: [] });
  const key = direction === null ? '' : `${city}::${routeName}::${direction}`;

  useEffect(() => {
    if (direction === null || !routeName) return;
    const poller = createPoller({
      intervalMs: ROUTE_DETAIL_REFRESH_MS,
      visibility: appStateVisibility,
      task: async ({ signal }) => {
        try {
          const res = await getLiveBusPositions({ routeName, city, direction }, signal);
          if (signal.aborted) return;
          setState({ key, buses: res.data?.buses ?? [] });
        } catch (error) {
          if (signal.aborted) return;
          logger.warn('[bus] live positions failed', error);
          // 失敗也算查完：保留上一份位置（同方向），讓畫面不必一直等車輛資料。
          setState((prev) => (prev.key === key ? prev : { key, buses: [] }));
        }
      },
    });
    poller.start();
    return () => poller.stop();
  }, [routeName, city, direction, key]);

  // 換方向的第一個 render 不能回傳另一個方向的車。
  return state.key === key ? { buses: state.buses, settled: true } : { buses: [], settled: false };
}
