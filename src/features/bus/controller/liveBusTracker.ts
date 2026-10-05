import type { BusLeg } from '@/features/route';

import { fetchRouteDetailCached } from '../api/busRouteDetailCache';
import { getBusArrival, getLiveBusPositions } from '../api/transit';
import { matchesSelection, pickNextArrival, type RideSelection } from '../domain/busDirections';
import { equalStopName, resolveCurrentStopSeq, resolveLegRide } from '../domain/busLegStops';
import type { LiveBus, RouteDetailStop } from '../types/transit';

/**
 * 移植自 Web `src/hook/useLiveBusPositions.ts`（commit 5eadc71）的 `fetchLeg` 與其輔助函式；TDX 方向／支線配對已依 2026-10-05 契約改寫。
 * 輪詢迴圈本身改由 `busWatchers.ts`（`shared/polling`）以 AppState 控制（Web 用 `document.hidden`）。
 */

/**
 * TDX 認得的這趟車的名稱。子路線（99／99延）各有站序與車輛，規劃器會說它訂的是哪一個——
 * 用母路線名稱查會把兩者混在一起回來。
 */
export function tdxRouteName(leg: BusLeg): string {
  return leg.subRouteName ?? leg.routeName;
}

interface ArrivalTarget {
  /** 上車站下一班車的車牌（與 {@link eta} 來自同一筆到站紀錄）。 */
  plate?: string;
  /** 本 leg 這組站序在上車站最快的 ETA（分鐘）。 */
  eta: number | null;
}

/**
 * 從到站（ETA）資料找上車站的下一班車。後端已把 TDX 車牌帶進每筆到站資料，所以最快的那筆
 * 同時告訴我們「何時來」與「哪一台」——這是鎖定「你要搭的那台車」最可靠的方式。
 * 站名、支線、方向都要和乘車區間吻合，ETA 必須是合法的非負數；查詢失敗不沿用任何舊值。
 */
async function fetchArrival(leg: BusLeg, selection: RideSelection, signal: AbortSignal): Promise<ArrivalTarget> {
  try {
    const res = await getBusArrival(
      { routeName: tdxRouteName(leg), stopName: leg.departureStop, direction: selection.direction, city: leg.tdxCity },
      signal,
    );
    if (!res.ok || !res.data?.arrivals) return { eta: null };
    const next = pickNextArrival(res.data.arrivals, leg.departureStop, selection);
    return next ? { plate: next.plateNumb, eta: next.estimateMinutes } : { eta: null };
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

/** 上車站下一班車的 ETA：與 {@link LegSnapshot.buses} 同一輪查詢，沒有可確定的紀錄時為 null。 */
export interface LegArrival {
  eta: number | null;
  /** 與 {@link eta} 同一筆到站紀錄的車牌；TDX 尚未派車時沒有。 */
  plate?: string;
}

export interface LegSnapshot {
  buses: LiveBus[];
  arrival: LegArrival;
}

const NO_ARRIVAL: LegArrival = { eta: null };

/** 實際營運的支線與方向（GTFS 方向不可信）；認不出唯一乘車區間就回 null。 */
async function resolveSelection(leg: BusLeg): Promise<{ selection: RideSelection; stops: RouteDetailStop[] } | null> {
  // route-detail 已被站序預熱，通常是讀快取。
  const city = leg.tdxCity ?? leg.cityCode ?? '';
  const directions = city ? await fetchRouteDetailCached(tdxRouteName(leg), city) : null;
  const ride = resolveLegRide(directions ?? undefined, leg);
  if (!ride) return null;
  // 站序資料沒有帶支線 ID 時，退回規劃器訂的那一支：回傳紀錄若自稱別的支線就能被排除。
  return {
    selection: { direction: ride.direction, subRouteUid: ride.subRouteUid ?? leg.subRouteUid, exclusive: ride.exclusive },
    stops: ride.stops,
  };
}

/**
 * 解析本 leg 使用者要搭的那一台車，連同上車站的下一班 ETA。無法鎖定車牌時 `buses` 為空陣列：認不出來的車比沒有更糟，
 * 因為「這條線上的某台車」的 marker 會被讀成「你的車」；但 ETA 不需要車牌（尚未發車的班次也有），照樣回報。
 */
export async function fetchLegSnapshot(leg: BusLeg, signal: AbortSignal): Promise<LegSnapshot> {
  // 認不出唯一乘車區間（重複站名、多個候選、缺資料、方向未知）就不追車：保留排程，不猜。
  const resolved = await resolveSelection(leg);
  if (!resolved) return { buses: [], arrival: NO_ARRIVAL };
  const { selection, stops } = resolved;

  // ETA 與位置互相獨立，一起跑。
  const [arrival, posRes] = await Promise.all([
    fetchArrival(leg, selection, signal),
    getLiveBusPositions({ routeName: tdxRouteName(leg), city: leg.tdxCity, direction: selection.direction }, signal),
  ]);
  const legArrival: LegArrival = arrival.plate ? { eta: arrival.eta, plate: arrival.plate } : { eta: arrival.eta };

  if (!posRes.ok || !posRes.data?.buses?.length) return { buses: [], arrival: legArrival };

  // 查詢已帶方向，這裡仍要自己確認每台車屬於同一支線、同一方向。
  const buses = posRes.data.buses.filter((b) => matchesSelection(b, selection));
  const targetPlate = resolveTargetPlate(buses, arrival.plate);
  if (!targetPlate || arrival.eta === null) return { buses: [], arrival: legArrival };

  const target = buses.find((b) => b.plateNumb === targetPlate);
  if (!target) return { buses: [], arrival: legArrival };

  // 最後一道防線：已經過了上車站的車不可能是使用者要搭的，不管資料怎麼說。
  if (hasPassedBoardingStop(stops, target)) return { buses: [], arrival: legArrival };

  // `targetPlate` 只可能是到站紀錄點名的車牌，所以下面的 ETA 描述的就是這台車——
  // 一台車的車牌旁邊絕不能放另一台車的倒數。
  return {
    buses: [
      {
        ...target,
        routeName: leg.routeName,
        city: leg.tdxCity ?? '',
        isTarget: true,
        estimateTime: arrival.eta,
        etaStopName: leg.departureStop,
      },
    ],
    arrival: legArrival,
  };
}

/** {@link fetchLegSnapshot} 只取車輛（路線卡展開時的 marker）。 */
export async function fetchLeg(leg: BusLeg, signal: AbortSignal): Promise<LiveBus[]> {
  return (await fetchLegSnapshot(leg, signal)).buses;
}

/**
 * 已上車：使用者那台車（`plate`）到**下車站**的分鐘數。只採同站、同支線、同方向、同車牌的那一筆——
 * 下車站的下一班常是前一班車，拿它的數字會把剩餘時間報短。對不上或查詢失敗回 null，由呼叫端改用估算。
 */
export async function fetchRideArrival(leg: BusLeg, plate: string, signal: AbortSignal): Promise<number | null> {
  const resolved = await resolveSelection(leg);
  if (!resolved) return null;
  const { selection } = resolved;
  try {
    const res = await getBusArrival(
      { routeName: tdxRouteName(leg), stopName: leg.arrivalStop, direction: selection.direction, city: leg.tdxCity },
      signal,
    );
    if (!res.ok || !res.data?.arrivals) return null;
    const mine = res.data.arrivals.find(
      (a) =>
        a.plateNumb === plate &&
        equalStopName(a.stopName, leg.arrivalStop) &&
        matchesSelection(a, selection) &&
        typeof a.estimateMinutes === 'number' &&
        Number.isFinite(a.estimateMinutes) &&
        a.estimateMinutes >= 0,
    );
    return mine?.estimateMinutes ?? null;
  } catch {
    return null;
  }
}
