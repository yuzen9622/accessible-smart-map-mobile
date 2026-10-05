import { useEffect, useState } from 'react';

import { appStateVisibility, createPoller } from '@/shared/polling';

import { getBusArrival } from '../api/transit';
import { pickNextArrival, type NextArrival, type RideSelection } from '../domain/busDirections';
import { STOP_ARRIVALS_REFRESH_MS } from './useStopArrivals';

/**
 * 路線詳情「追一班車」用：使用者那一站、這組站序（支線＋方向）下一班車的到站紀錄——ETA 與車牌取自同一筆。
 * route-detail 的站序不擁有車牌，所以車牌只能從 `/bus/arrival` 取；之後由呼叫端用車牌與 positions 精確對應。
 *
 * 沒有可確定的紀錄（站名／支線／方向不符、ETA 不合法、查詢失敗、方向 255）回 null——不沿用上一輪的車牌。
 * 資料連同 key 一起存，換選擇後才完成的舊回應不會寫入。
 */
export function useTrackedArrival(
  routeName: string,
  city: string,
  stopName: string,
  selection: RideSelection | null,
): NextArrival | null {
  const [state, setState] = useState<{ key: string; arrival: NextArrival | null }>({ key: '', arrival: null });
  const direction = selection?.direction ?? null;
  const subRouteUid = selection?.subRouteUid;
  const exclusive = selection?.exclusive ?? false;
  const enabled = direction !== null && direction !== 255 && Boolean(routeName && stopName);
  const key = enabled ? `${city}::${routeName}::${stopName}::${subRouteUid ?? ''}::${direction}::${exclusive}` : '';

  useEffect(() => {
    if (!enabled || direction === null) return;
    const own: RideSelection = { direction, subRouteUid, exclusive };
    let current = true;
    const poller = createPoller({
      intervalMs: STOP_ARRIVALS_REFRESH_MS,
      visibility: appStateVisibility,
      task: async ({ signal }) => {
        let arrival: NextArrival | null = null;
        try {
          const res = await getBusArrival({ routeName, stopName, direction, city }, signal);
          if (res.ok && res.data) arrival = pickNextArrival(res.data.arrivals, stopName, own);
        } catch {
          arrival = null;
        }
        if (signal.aborted || !current) return;
        setState({ key, arrival });
      },
    });
    poller.start();
    return () => {
      current = false;
      poller.stop();
    };
  }, [enabled, routeName, city, stopName, direction, subRouteUid, exclusive, key]);

  return state.key === key && key !== '' ? state.arrival : null;
}
