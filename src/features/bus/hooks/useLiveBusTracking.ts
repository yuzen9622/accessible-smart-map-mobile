import { useEffect } from 'react';

import { useRouteSession } from '@/features/route';
import { appStateVisibility } from '@/shared/polling';

import { watchLiveBus, watchRideArrival } from '../controller/busWatchers';
import { useBusStore } from '../store/busStore';

/**
 * 地圖畫面掛一次：只追蹤使用者展開的那段公車 leg（`activeBusLeg`）要搭的那台車，每 15 秒更新
 * （對齊 Web `useLiveBusPositions`）；導航判定已上車後改成只查那台車到下車站的時間。沒有展開的 leg 時不註冊任何計時器與監聽，剛規劃好的路線零請求。
 *
 * 另外負責 Web route slice 以前順手做的清理：選中的路線換成別的物件（重新規劃、重算、session 結束）時，
 * 展開的 leg 已不屬於畫面上的路線，清掉它與車輛位置——追到別人的車比沒有 marker 更糟。
 */
export function useLiveBusTracking(): void {
  const legKey = useBusStore((s) => s.activeBusLeg?.key ?? null);
  const selectedRoute = useRouteSession((s) => s.selectRoute?.route ?? null);

  useEffect(() => {
    const { activeBusLeg, setActiveBusLeg } = useBusStore.getState();
    if (activeBusLeg && activeBusLeg.route !== selectedRoute) setActiveBusLeg(null);
  }, [selectedRoute]);

  // 已上車（導航判定）：改查下車站，空字串＝上車時沒鎖到車牌、不再輪詢；null＝還沒上車。
  const boardedPlate = useBusStore((s) => {
    const boarded = s.activeBusLeg?.boarded;
    return boarded ? (boarded.plate ?? '') : null;
  });

  useEffect(() => {
    if (!legKey) return;
    // 每一輪都讀最新的 leg（Web 的 legRef），而不是啟動當下捕捉的那個物件。
    const getLeg = () => useBusStore.getState().activeBusLeg?.leg ?? null;
    const store = useBusStore.getState();
    let stop: () => void = () => {};
    if (boardedPlate === null) {
      stop = watchLiveBus(
        getLeg,
        ({ buses, arrival }) => {
          const s = useBusStore.getState();
          s.setLiveBusPositions(buses);
          s.setLegArrival({ stop: 'board', eta: arrival.eta });
        },
        appStateVisibility,
      );
    } else {
      // 車上不畫「開往上車站的車」：使用者自己就在那台車上。
      store.setLiveBusPositions([]);
      store.setLegArrival({ stop: 'alight', eta: null });
      if (boardedPlate) {
        stop = watchRideArrival(getLeg, boardedPlate, (eta) => useBusStore.getState().setLegArrival({ stop: 'alight', eta }), appStateVisibility);
      }
    }
    return () => {
      stop();
      const s = useBusStore.getState();
      s.setLiveBusPositions([]);
      s.setLegArrival(null);
    };
  }, [legKey, boardedPlate]);
}
