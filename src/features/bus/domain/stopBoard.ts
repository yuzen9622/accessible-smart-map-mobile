// 設計 2b「站牌（下一班優先）」與「路線（追一班車）」的純邏輯：站牌上哪一班無障礙車最快到、
// 站牌在路線哪個方向第幾站、每台車最接近哪一站、下一台到你這站的是哪台車。
// 不 import react-native／expo，可在 node 下測。
import { haversineMeters, type LatLng } from '@/shared/geo';

import type { LiveBus, RouteDetailDirection, RouteDetailStop, StopArrival } from '../types/transit';
import { equalStopName } from './busLegStops';
import { isAccessibleBus } from './liveBusGeoJson';

/** 車輛離最近一站超過這個距離就算「在兩站之間」，不當成停在該站。 */
export const BUS_AT_STOP_RADIUS_M = 200;
/** ETA 超過這個分鐘數，卻被判定在你這站的車，是剛開走的車，不算下一班。 */
const JUST_LEFT_ETA_MINUTES = 3;

export interface StopMatch {
  direction: 0 | 1;
  /** 你這站在該方向站序中的索引（0 起算）。 */
  index: number;
  stop: RouteDetailStop;
  stops: RouteDetailStop[];
  /** 該方向的終點站名（「往 X」）。 */
  headsign: string;
}

/**
 * 在路線的各方向裡找出使用者的站牌。同名站牌常在兩個方向都有（對街兩側），
 * 有座標時取離座標最近的那一個；沒有座標時取第一個同名站。
 */
export function matchStopInRoute(
  directions: readonly RouteDetailDirection[],
  stopName: string,
  position: LatLng | null,
  preferredDirection?: 0 | 1 | null,
): StopMatch | null {
  let best: StopMatch | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const dir of directions) {
    if (preferredDirection !== undefined && preferredDirection !== null && dir.direction !== preferredDirection) continue;
    for (let index = 0; index < dir.stops.length; index += 1) {
      const stop = dir.stops[index];
      if (!equalStopName(stop.name, stopName)) continue;
      const dist = position ? haversineMeters(position, { lat: stop.lat, lng: stop.lng }) : 0;
      if (dist >= bestDist) continue;
      bestDist = dist;
      best = { direction: dir.direction, index, stop, stops: dir.stops, headsign: dir.stops.at(-1)?.name ?? '' };
    }
  }
  return best;
}

export interface PlacedBus {
  plateNumb: string;
  /** 最接近的站在站序中的索引。 */
  index: number;
  /** 在該站 {@link BUS_AT_STOP_RADIUS_M} 內。 */
  atStop: boolean;
  accessible: boolean;
  isLowFloor: boolean;
}

/** 把同方向的車輛對應到最接近的站。 */
export function placeBuses(stops: readonly RouteDetailStop[], buses: readonly LiveBus[], direction: 0 | 1): PlacedBus[] {
  if (stops.length === 0) return [];
  const placed: PlacedBus[] = [];
  for (const bus of buses) {
    if (bus.direction !== direction || !Number.isFinite(bus.lat) || !Number.isFinite(bus.lng)) continue;
    let bestIndex = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    stops.forEach((stop, index) => {
      const dist = haversineMeters({ lat: bus.lat, lng: bus.lng }, { lat: stop.lat, lng: stop.lng });
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = index;
      }
    });
    placed.push({
      plateNumb: bus.plateNumb,
      index: bestIndex,
      atStop: bestDist <= BUS_AT_STOP_RADIUS_M,
      accessible: isAccessibleBus(bus),
      isLowFloor: bus.isLowFloor === '是',
    });
  }
  return placed;
}

export interface ApproachingBus {
  bus: PlacedBus;
  /** 車子還差幾站到你這站（0 = 就在你這站）。 */
  stopsAway: number;
}

/**
 * 下一台會到你這站的車：你這站（含）之前、最接近你這站的那台。
 * 被判定在你這站、但該站 ETA 還很久的車是剛開走的，排除。
 */
export function nextBusToStop(
  placed: readonly PlacedBus[],
  stopIndex: number,
  etaMinutes: number | null,
): ApproachingBus | null {
  let best: PlacedBus | null = null;
  for (const bus of placed) {
    if (bus.index > stopIndex) continue;
    if (bus.index === stopIndex && etaMinutes !== null && etaMinutes > JUST_LEFT_ETA_MINUTES) continue;
    if (!best || bus.index > best.index) best = bus;
  }
  return best ? { bus: best, stopsAway: stopIndex - best.index } : null;
}

/** 下一班確定是低地板或有升降設備。未知（null）不算。 */
export function isAccessibleArrival(arrival: Pick<StopArrival, 'isLowFloor' | 'hasLiftOrRamp'>): boolean {
  return arrival.isLowFloor === true || arrival.hasLiftOrRamp === true;
}

function etaSortKey(arrival: Pick<StopArrival, 'estimateMinutes'>): number {
  const m = arrival.estimateMinutes;
  return m === null || !Number.isFinite(m) || m < 0 ? Number.POSITIVE_INFINITY : m;
}

/** 依到站分鐘數排序，沒有分鐘數的排後面。 */
export function sortArrivals<T extends Pick<StopArrival, 'estimateMinutes'>>(arrivals: readonly T[]): T[] {
  return [...arrivals].sort((a, b) => etaSortKey(a) - etaSortKey(b));
}

/** 主色卡要回答的那一班：下一班是無障礙車、且有到站分鐘數的路線中最快到的。 */
export function pickFeaturedArrival<T extends Pick<StopArrival, 'estimateMinutes' | 'isLowFloor' | 'hasLiftOrRamp'>>(
  arrivals: readonly T[],
): T | null {
  return sortArrivals(arrivals).find((a) => isAccessibleArrival(a) && etaSortKey(a) !== Number.POSITIVE_INFINITY) ?? null;
}

/** 站牌上有行經、但這次沒有到站資料的路線（仍列在「全部路線」，點進去看路線詳情）。 */
export function routesWithoutArrivals(routes: readonly string[], arrivals: readonly Pick<StopArrival, 'routeName'>[]): string[] {
  const seen = new Set(arrivals.map((a) => a.routeName));
  return routes.filter((route) => !seen.has(route));
}

/** 路線詳情開啟時的鏡頭範圍最小跨度（度），避免只剩兩站時鏡頭貼得太近。 */
const MIN_SPAN_DEG = 0.006;

/**
 * 站序第 `from`～`to` 站的範圍 `[west, south, east, north]`（索引會夾在站序內）；沒有站時回 null。
 * 路線詳情用它把鏡頭對到「車子 → 你這站」這一段，而不是整條 60 站的路線。
 */
export function stopsBounds(
  stops: readonly Pick<RouteDetailStop, 'lat' | 'lng'>[],
  from = 0,
  to = stops.length - 1,
): [number, number, number, number] | null {
  const start = Math.max(0, Math.min(from, to));
  const end = Math.min(stops.length - 1, Math.max(from, to));
  if (stops.length === 0 || start > end) return null;
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (let i = start; i <= end; i += 1) {
    const { lat, lng } = stops[i];
    w = Math.min(w, lng);
    e = Math.max(e, lng);
    s = Math.min(s, lat);
    n = Math.max(n, lat);
  }
  const padLng = Math.max(0, (MIN_SPAN_DEG - (e - w)) / 2);
  const padLat = Math.max(0, (MIN_SPAN_DEG - (n - s)) / 2);
  return [w - padLng, s - padLat, e + padLng, n + padLat];
}
