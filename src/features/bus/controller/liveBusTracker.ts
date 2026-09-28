import type { BusLeg } from '@/features/route';

import { fetchRouteDetailCached } from '../api/busRouteDetailCache';
import { getBusArrival, getLiveBusPositions } from '../api/transit';
import { resolveCurrentStopSeq, resolveLegRide } from '../domain/busLegStops';
import type { LiveBus, RouteDetailStop } from '../types/transit';

/**
 * 移植自 Web `src/hook/useLiveBusPositions.ts`（commit 5eadc71）的 `fetchLeg` 與其輔助函式，邏輯逐行保留。
 * 輪詢迴圈本身改由 `busWatchers.ts`（`shared/polling`）以 AppState 控制（Web 用 `document.hidden`）。
 */

/**
 * TDX 認得的這趟車的名稱。子路線（99／99延）各有站序與車輛，規劃器會說它訂的是哪一個——
 * 用母路線名稱查會把兩者混在一起回來。
 */
export function tdxRouteName(leg: BusLeg): string {
  return leg.subRouteName ?? leg.routeName;
}

/**
 * 這筆紀錄是否屬於本 leg 搭的子路線。{@link tdxRouteName} 之後的第二道防線：母路線名稱查詢
 * 仍會回所有子路線，99延 的車停的站 99 的乘客根本到不了。沒帶子路線的紀錄照收——
 * 後端說不出來不代表不相符。
 */
function onLegSubRoute(leg: BusLeg, subRouteUid?: string): boolean {
  if (!leg.subRouteUid || !subRouteUid) return true;
  return leg.subRouteUid === subRouteUid;
}

interface ArrivalTarget {
  /** 上車站下一班車的車牌（TDX 已派車時才有）。 */
  plate?: string;
  /** 本 leg 方向在上車站最快的 ETA（分鐘）。 */
  eta: number | null;
}

/**
 * 從到站（ETA）資料找上車站的下一班車。後端已把 TDX 車牌帶進每筆到站資料，所以最快的那筆
 * 同時告訴我們「何時來」與「哪一台」——這是鎖定「你要搭的那台車」最可靠的方式。
 */
async function fetchArrival(leg: BusLeg, direction: 0 | 1, signal: AbortSignal): Promise<ArrivalTarget> {
  try {
    const res = await getBusArrival(
      { routeName: tdxRouteName(leg), stopName: leg.departureStop, direction, city: leg.tdxCity },
      signal,
    );
    if (!res.ok || !res.data?.arrivals) return { eta: null };

    let next: { plateNumb?: string; estimateMinutes: number } | undefined;
    for (const a of res.data.arrivals) {
      if (!onLegSubRoute(leg, a.subRouteUid) || a.direction !== direction) continue;
      if (typeof a.estimateMinutes !== 'number') continue;
      if (!next || a.estimateMinutes < next.estimateMinutes) {
        next = { plateNumb: a.plateNumb, estimateMinutes: a.estimateMinutes };
      }
    }
    if (!next) return { eta: null };

    const plate = next.plateNumb && next.plateNumb !== '-1' ? next.plateNumb : undefined;
    return { plate, eta: next.estimateMinutes };
  } catch {
    return { eta: null };
  }
}

/**
 * 決定哪台即時車輛是「使用者要搭的那一台」。唯一可信的訊號是**上車站**的到站資料：它點名的車
 * 按定義仍在往使用者等車的地方開。
 *
 * `leg.nearestBus` 以前是 fallback，但它是規劃路線當下的快照。鎖定它會追到「現在」跑這條線的車，
 * 然後把它已經停過的站全標成已過站並藏掉時刻。沒有派車時回傳 undefined：沒有 marker 好過別人的車。
 */
function resolveTargetPlate(buses: LiveBus[], arrivalPlate?: string): string | undefined {
  if (arrivalPlate && buses.some((b) => b.plateNumb === arrivalPlate)) return arrivalPlate;
  return undefined;
}

/**
 * 車輛是否已被定位在上車站**之後**。只有車輛夠靠近某站、定位得到時才判斷；在兩站之間
 * `resolveCurrentStopSeq` 回傳 null，繼續追蹤。
 */
function hasPassedBoardingStop(stops: RouteDetailStop[], bus: { lat: number; lng: number }): boolean {
  const seq = resolveCurrentStopSeq(stops, bus);
  if (seq == null) return false;
  const board = stops[0]?.seq;
  return board != null && seq > board;
}

/**
 * 解析本 leg 使用者要搭的那一台車。無法鎖定車牌時回傳空陣列：認不出來的車比沒有更糟，
 * 因為「這條線上的某台車」的 marker 會被讀成「你的車」。
 */
export async function fetchLeg(leg: BusLeg, signal: AbortSignal): Promise<LiveBus[]> {
  // 問 TDX 任何事之前先解析實際營運的方向。單靠 `leg.direction` 曾指到反方向，鎖定一台遠離
  // 使用者的車並顯示它的到站時間。route-detail 已被站序預熱，通常是讀快取。
  const city = leg.tdxCity ?? leg.cityCode ?? '';
  const directions = city ? await fetchRouteDetailCached(tdxRouteName(leg), city) : null;
  const ride = resolveLegRide(directions ?? undefined, leg);
  const direction = ride?.direction ?? leg.direction;

  // ETA 與位置互相獨立，一起跑。
  const [arrival, posRes] = await Promise.all([
    fetchArrival(leg, direction, signal),
    getLiveBusPositions({ routeName: tdxRouteName(leg), city: leg.tdxCity, direction }, signal),
  ]);

  if (!posRes.ok || !posRes.data?.buses?.length) return [];

  const buses = posRes.data.buses.filter((b) => onLegSubRoute(leg, b.subRouteUid));
  const targetPlate = resolveTargetPlate(buses, arrival.plate);
  if (!targetPlate) return [];

  const target = buses.find((b) => b.plateNumb === targetPlate);
  if (!target) return [];

  // 最後一道防線：已經過了上車站的車不可能是使用者要搭的，不管資料怎麼說。
  if (ride && hasPassedBoardingStop(ride.stops, target)) return [];

  // `targetPlate` 只可能是到站紀錄點名的車牌，所以下面的 ETA 描述的就是這台車——
  // 一台車的車牌旁邊絕不能放另一台車的倒數。
  return [
    {
      ...target,
      routeName: leg.routeName,
      city: leg.tdxCity ?? '',
      isTarget: true,
      estimateTime: arrival.eta,
      etaStopName: leg.departureStop,
    },
  ];
}
