import { useEffect } from 'react';

import { useRouteSession } from '@/features/route';
import { appStateVisibility } from '@/shared/polling';

import { watchLiveBus } from '../controller/busWatchers';
import { useBusStore } from '../store/busStore';

/**
 * 地圖畫面掛一次：只追蹤使用者展開的那段公車 leg（`activeBusLeg`）要搭的那台車，每 15 秒更新
 * （對齊 Web `useLiveBusPositions`）。沒有展開的 leg 時不註冊任何計時器與監聽，剛規劃好的路線零請求。
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

  useEffect(() => {
    if (!legKey) return;
    // 每一輪都讀最新的 leg（Web 的 legRef），而不是啟動當下捕捉的那個物件。
    const stop = watchLiveBus(
      () => useBusStore.getState().activeBusLeg?.leg ?? null,
      (buses) => useBusStore.getState().setLiveBusPositions(buses),
      appStateVisibility,
    );
    return () => {
      stop();
      useBusStore.getState().setLiveBusPositions([]);
    };
  }, [legKey]);
}
