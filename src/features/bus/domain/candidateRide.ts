import type { BusDepartureCandidate, LngLatTuple } from '@/features/route/domain';

import type { RouteDetailDirection, RouteDetailStop } from '../types/transit';

export interface CandidateRide {
  /** 上車站到下車站（含兩端）的站序。 */
  stops: RouteDetailStop[];
  /** 這班車在上下車站之間實際走的路（路線線形裁切；沒有線形時退回站序連線）。 */
  polyline: LngLatTuple[];
}

/** 線形點與站牌的距離超過這個就不信任裁切結果（線形屬於別的方向或資料錯位）。 */
const MAX_SNAP_M = 150;
const EARTH_M = 6_371_000;

interface Snap {
  segIndex: number;
  t: number;
  distM: number;
}

/** 在 `[from, end)` 的線段中找離 `p` 最近的投影點（等距圓柱近似，公車站間距離夠小）。 */
function snap(line: readonly LngLatTuple[], p: { lat: number; lng: number }, from: number): Snap | null {
  const k = Math.cos((p.lat * Math.PI) / 180);
  const xy = ([lng, lat]: LngLatTuple) => ({ x: ((lng - p.lng) * Math.PI * EARTH_M * k) / 180, y: ((lat - p.lat) * Math.PI * EARTH_M) / 180 });
  let best: Snap | null = null;
  for (let i = from; i < line.length - 1; i++) {
    const a = xy(line[i]);
    const b = xy(line[i + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq > 0 ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lenSq)) : 0;
    const distM = Math.hypot(a.x + t * dx, a.y + t * dy);
    if (!best || distM < best.distM) best = { segIndex: i, t, distM };
  }
  return best;
}

function lerp(line: readonly LngLatTuple[], s: Snap): LngLatTuple {
  const [x1, y1] = line[s.segIndex];
  const [x2, y2] = line[s.segIndex + 1];
  return [x1 + (x2 - x1) * s.t, y1 + (y2 - y1) * s.t];
}

/**
 * 把整條路線的線形裁成上車站到下車站那一段。下車站只在上車站之後找，循環線不會折回去；
 * 任一端離線形太遠就回 null，由呼叫端退回站序連線。
 */
export function sliceRoutePolyline(
  line: readonly LngLatTuple[] | undefined,
  board: { lat: number; lng: number },
  alight: { lat: number; lng: number },
): LngLatTuple[] | null {
  if (!line || line.length < 2) return null;
  const start = snap(line, board, 0);
  if (!start || start.distM > MAX_SNAP_M) return null;
  const end = snap(line, alight, start.segIndex);
  if (!end || end.distM > MAX_SNAP_M) return null;
  if (end.segIndex === start.segIndex && end.t < start.t) return null;
  return [lerp(line, start), ...line.slice(start.segIndex + 1, end.segIndex + 1), lerp(line, end)];
}

/**
 * 某一班候選公車自己的乘車區間：在它的子路線、它的方向裡，依候選班次給的上下車站 ID
 * （= route-detail 的 `stopUid`，同一實體站在不同路線的 ID 不同）切出站序與線形。
 * 找不到唯一區間（站不在這條線上、下車站在上車站之前）就回 null，不猜。
 */
export function resolveCandidateRide(
  directions: readonly RouteDetailDirection[] | null | undefined,
  candidate: Pick<BusDepartureCandidate, 'subRouteUid' | 'direction' | 'departureStopId' | 'arrivalStopId'>,
): CandidateRide | null {
  if (!directions?.length) return null;
  const runs = directions.filter((d) => (d.subRouteUid === undefined || d.subRouteUid === candidate.subRouteUid) && d.direction !== 255);
  // 候選班次的方向來自 TDX 即時資料，先信它；對不上時才看同子路線的其他方向
  const ordered = [...runs.filter((d) => d.direction === candidate.direction), ...runs.filter((d) => d.direction !== candidate.direction)];
  for (const run of ordered) {
    const from = run.stops.findIndex((s) => s.stopUid === candidate.departureStopId);
    if (from < 0) continue;
    const to = run.stops.findIndex((s, i) => i > from && s.stopUid === candidate.arrivalStopId);
    if (to < 0) continue;
    const stops = run.stops.slice(from, to + 1);
    const polyline =
      sliceRoutePolyline(run.polyline, stops[0], stops[stops.length - 1]) ?? stops.map((s): LngLatTuple => [s.lng, s.lat]);
    return { stops, polyline };
  }
  return null;
}
