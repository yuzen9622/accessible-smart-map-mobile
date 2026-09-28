import { useEffect, useRef, useState } from 'react';

import type { BusLeg } from '@/features/route';
import { appStateVisibility } from '@/shared/polling';

import { peekLegEtas, watchLegStopEtas, type LegEtaSnapshot } from '../controller/busWatchers';

const IDLE: LegEtaSnapshot = { directions: null, status: 'idle' };

/**
 * 單一公車 leg 的逐站 ETA（對齊 Web `useBusLegStopEtas`，commit 5eadc71）。`enabled` 與 `poll` 分開：
 * 選了路線就 enable 預熱共用快取，展開 leg 才開始 20 秒輪詢。回傳兩個方向，由呼叫端以
 * `resolveLegStops` 挑出這趟車（`leg.direction` 不可信）。
 *
 * 只在「路線名稱＋城市」或啟用狀態變化時重啟；同一段 leg 物件重建不重啟（Web 用 legRef 做同一件事）。
 */
export function useBusLegStopEtas(leg: BusLeg | null, enabled: boolean, poll: boolean): LegEtaSnapshot {
  const key = leg ? `${leg.tdxCity ?? leg.cityCode ?? ''}::${leg.subRouteName ?? leg.routeName}` : '';
  // snapshot 連同它屬於哪條路線一起存：換 leg 的第一個 render 不能回傳上一條路線的站序。
  const [state, setState] = useState<{ key: string; snapshot: LegEtaSnapshot }>(() => ({ key, snapshot: peekLegEtas(leg) }));
  const legRef = useRef(leg);

  useEffect(() => {
    legRef.current = leg;
  });

  useEffect(() => {
    const current = legRef.current;
    if (!enabled || !current || !key) return;
    return watchLegStopEtas(current, poll, (snapshot) => setState({ key, snapshot }), appStateVisibility);
  }, [enabled, poll, key]);

  if (!enabled || !key) return IDLE;
  return state.key === key ? state.snapshot : peekLegEtas(leg);
}
