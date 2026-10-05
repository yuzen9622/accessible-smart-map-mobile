import { useEffect, useState } from 'react';

import { logger } from '@/shared/logger';
import { appStateVisibility, createPoller } from '@/shared/polling';

import { getLiveBusPositions } from '../api/transit';
import { belongsToSelection, type RideSelection } from '../domain/busDirections';
import type { LiveBus } from '../types/transit';
import { ROUTE_DETAIL_REFRESH_MS } from './useBusRouteDetail';

export interface RouteLiveBuses {
  buses: LiveBus[];
  /** 這組站序的第一次查詢已經回來（成功或失敗都算）。 */
  settled: boolean;
}

/**
 * 路線詳情用：某一組站序（支線＋方向）所有車輛的即時位置，與站序同樣每 30 秒更新。
 *
 * 查詢帶方向，但回來的車仍要自己確認屬於同一支線與方向（255 的車可顯示位置，但 `placeBuses` 不會把它配到任何站）。查詢失敗回空陣列：
 * 上一輪的位置不能當成本輪成功。資料連同 key（城市、路線、支線、方向）一起存，換選擇後才完成的舊回應
 * 不會寫入，換選擇的第一個 render 也不會回傳另一組的車。
 */
export function useRouteLiveBuses(routeName: string, city: string, selection: RideSelection | null): RouteLiveBuses {
  const [state, setState] = useState<{ key: string; buses: LiveBus[] }>({ key: '', buses: [] });
  const direction = selection?.direction ?? null;
  const subRouteUid = selection?.subRouteUid;
  const exclusive = selection?.exclusive ?? false;
  // 唯一性是缺 UID 資料能否安全配對的前提；前提改變後不能重用舊的已過濾結果。
  const key = direction === null ? '' : `${city}::${routeName}::${subRouteUid ?? ''}::${direction}::${exclusive}`;

  useEffect(() => {
    if (direction === null || !routeName) return;
    const own: RideSelection = { direction, subRouteUid, exclusive };
    let current = true;
    const poller = createPoller({
      intervalMs: ROUTE_DETAIL_REFRESH_MS,
      visibility: appStateVisibility,
      task: async ({ signal }) => {
        try {
          const res = await getLiveBusPositions({ routeName, city, direction }, signal);
          if (signal.aborted || !current) return;
          const buses = res.ok ? (res.data?.buses ?? []).filter((b) => belongsToSelection(b, own)) : [];
          setState({ key, buses });
        } catch (error) {
          if (signal.aborted || !current) return;
          logger.warn('[bus] live positions failed', error);
          setState({ key, buses: [] });
        }
      },
    });
    poller.start();
    return () => {
      current = false;
      poller.stop();
    };
  }, [routeName, city, direction, subRouteUid, exclusive, key]);

  return state.key === key && key !== '' ? { buses: state.buses, settled: true } : { buses: [], settled: false };
}
