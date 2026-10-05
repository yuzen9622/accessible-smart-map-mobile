import type { BusLeg } from '@/features/route';
import { createPoller, type VisibilitySource } from '@/shared/polling';

import { fetchRouteDetailCached, peekRouteDetail } from '../api/busRouteDetailCache';
import { stripLiveEta } from '../domain/busDirections';
import type { LiveBus, RouteDetailDirection } from '../types/transit';
import { fetchLeg, tdxRouteName } from './liveBusTracker';

/**
 * 移植自 Web `src/hook/useLiveBusPositions.ts` 與 `src/hook/useBusLegStopEtas.ts`（commit 5eadc71）的
 * 輪詢迴圈。Web 把迴圈寫在 `useEffect` 裡、以 `document.hidden` 暫停；本版抽成不依賴 React 的 watcher，
 * 由 `createPoller` 以 AppState 暫停／回前景立即刷新，hook 只負責啟停。
 */

export const LIVE_BUS_POLL_MS = 15_000;
export const STOP_ETA_POLL_MS = 20_000;

/**
 * 每 15 秒更新使用者要搭的那一台車。每一輪都透過 `getLeg` 重讀目前的 leg（Web 的 legRef）；
 * leg 已不存在就停止回報。查詢失敗回報空陣列：不沿用上一輪的車牌與位置冒充本輪成功。回傳停止函式；停止時 abort 進行中的請求。
 */
export function watchLiveBus(
  getLeg: () => BusLeg | null,
  onBuses: (buses: LiveBus[]) => void,
  visibility: VisibilitySource,
): () => void {
  const poller = createPoller({
    intervalMs: LIVE_BUS_POLL_MS,
    visibility,
    task: async ({ signal }) => {
      const leg = getLeg();
      if (!leg) return;
      let buses: LiveBus[];
      try {
        buses = await fetchLeg(leg, signal);
      } catch {
        buses = [];
      }
      if (!signal.aborted) onBuses(buses);
    },
  });
  poller.start();
  return () => poller.stop();
}

export type BusLegEtaStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface LegEtaSnapshot {
  directions: RouteDetailDirection[] | null;
  status: BusLegEtaStatus;
}

function legQuery(leg: BusLeg | null): { routeName: string; city: string } | null {
  if (!leg) return null;
  const city = leg.tdxCity ?? leg.cityCode ?? '';
  // TDX 以子路線索引站序：99 與 99延 是不同清單。規劃器說了它選哪個，就問那個。
  const routeName = tdxRouteName(leg);
  return routeName && city ? { routeName, city } : null;
}

/** 已預熱的快取；hook 用它當初始狀態，展開後第一個 render 就是真資料而不是載入中。 */
export function peekLegEtas(leg: BusLeg | null): LegEtaSnapshot {
  const q = legQuery(leg);
  const warm = q ? peekRouteDetail(q.routeName, q.city) : null;
  return warm ? { directions: warm, status: 'ready' } : { directions: null, status: 'idle' };
}

/**
 * 單一公車 leg 的逐站 ETA。
 *
 * `poll` 為 false 時只預熱共用快取一次（選路線時就先抓，使用者展開時資料已經在）；為 true 時每 20 秒
 * **強制**刷新——否則輪詢會一直被 route-detail 快取服務，只因 TTL 剛好比間隔短才更新。
 * 回傳兩個方向而不是 leg 宣告的方向：挑哪個方向是 `resolveLegStops` 的工作（`leg.direction` 不可信）。
 */
export function watchLegStopEtas(
  leg: BusLeg,
  poll: boolean,
  onUpdate: (snapshot: LegEtaSnapshot) => void,
  visibility: VisibilitySource,
): () => void {
  const q = legQuery(leg);
  if (!q) {
    onUpdate({ directions: null, status: 'idle' });
    return () => {};
  }

  let cancelled = false;
  // 已有暖快取就不要蓋一個載入中上去。
  let last = peekRouteDetail(q.routeName, q.city);
  onUpdate(last ? { directions: last, status: 'ready' } : { directions: null, status: 'loading' });

  const fetchEtas = async (force: boolean, signal?: AbortSignal) => {
    const fetched = await fetchRouteDetailCached(q.routeName, q.city, { force });
    // 回前景的那一輪會 abort 進行中的那一輪；被取代的結果不得晚到蓋掉較新的。
    if (cancelled || signal?.aborted) return;
    if (fetched) last = fetched;
    else if (last) last = stripLiveEta(last);
    // 失敗時保留靜態站序（讓行程仍可看站名與班表），但清掉舊的即時 ETA 與狀態，並標成 error。
    onUpdate(fetched ? { directions: fetched, status: 'ready' } : { directions: last ? stripLiveEta(last) : null, status: 'error' });
  };

  if (!poll) {
    void fetchEtas(false);
    return () => {
      cancelled = true;
    };
  }

  const poller = createPoller({
    intervalMs: STOP_ETA_POLL_MS,
    visibility,
    task: async ({ first, signal }) => fetchEtas(!first, signal),
  });
  poller.start();
  return () => {
    cancelled = true;
    poller.stop();
  };
}
