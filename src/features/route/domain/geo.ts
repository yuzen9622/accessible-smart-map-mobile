// 移植自 Web `src/lib/geo.ts`（commit 5eadc71）的路線／導航部分，邏輯逐行保留。
// 通用的 `haversineMeters` 已在 Phase 1 放進 `shared/geo`，這裡沿用而不重複定義。
// 純函式、無 RN／Expo 依賴。座標同時用 [lng, lat]（路線 polyline）與 { lat, lng }（LatLng）。

import { haversineMeters, type LatLng } from '@/shared/geo';

import type { LngLatTuple, NavInstruction, RouteLeg } from '../types/route';

const M_PER_DEG_LAT = 111_320;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** 從 `a` 到 `b` 的初始方位角（0–360°，0 = 北）。 */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return normalizeDeg(toDeg(Math.atan2(y, x)));
}

/** 把任意角度收進 [0, 360)。 */
export function normalizeDeg(d: number): number {
  return ((d % 360) + 360) % 360;
}

/** 沿最短弧在兩個角度間內插，`t` ∈ [0,1]；用於平滑 heading／marker 旋轉。 */
export function shortestAngleLerp(from: number, to: number, t: number): number {
  const diff = ((to - from + 540) % 360) - 180;
  return normalizeDeg(from + diff * t);
}

export interface CumulativePath {
  /** 依序串接的路線點（LatLng）。 */
  path: LatLng[];
  /** cumM[i] = 路徑起點到第 i 點的距離（公尺）。 */
  cumM: number[];
  /** 每個 leg 在 path 中的區間，與 route.legs 對齊；空 leg 的 count 為 0。 */
  legRanges: { start: number; count: number }[];
}

/**
 * 依序把每個 leg 的 polyline 串成一條 LatLng 路徑與累積距離陣列。
 * 點原樣附加，`legRanges` 保留解析 per-leg `polylineIndex` 需要的位移。
 */
export function buildCumulativePath(legs: RouteLeg[]): CumulativePath {
  const path: LatLng[] = [];
  const legRanges: { start: number; count: number }[] = [];
  for (const leg of legs) {
    const start = path.length;
    if (leg.polyline?.length) {
      for (const [lng, lat] of leg.polyline) {
        path.push({ lat, lng });
      }
    }
    legRanges.push({ start, count: path.length - start });
  }
  const cumM: number[] = new Array<number>(path.length).fill(0);
  for (let i = 1; i < path.length; i++) {
    cumM[i] = cumM[i - 1] + haversineMeters(path[i - 1], path[i]);
  }
  return { path, cumM, legRanges };
}

export interface Projection {
  /** 使用者投影到的線段起點索引。 */
  segIndex: number;
  /** 使用者到路線的垂直距離（公尺）——偏航指標。 */
  perpDistM: number;
  /** 沿路線到投影點的距離（公尺）。 */
  alongM: number;
}

interface XY {
  x: number;
  y: number;
}

/** 以參考緯度做局部等距圓柱投影（公尺）。 */
function toXY(p: LatLng, refLat: number): XY {
  const mPerLng = M_PER_DEG_LAT * Math.cos(toRad(refLat));
  return { x: p.lng * mPerLng, y: p.lat * M_PER_DEG_LAT };
}

/**
 * 把 `point` 投影到 polyline `path`，回傳最近的線段、到路線的垂直距離與沿線距離。
 * 用局部平面近似——對路線線段這種短距離夠準。
 */
export function projectToPath(point: LatLng, path: LatLng[], cumM: number[]): Projection {
  if (path.length === 0) {
    return { segIndex: 0, perpDistM: Infinity, alongM: 0 };
  }
  if (path.length === 1) {
    return { segIndex: 0, perpDistM: haversineMeters(point, path[0]), alongM: 0 };
  }

  const refLat = point.lat;
  const P = toXY(point, refLat);

  let best: Projection = { segIndex: 0, perpDistM: Infinity, alongM: 0 };

  for (let i = 0; i < path.length - 1; i++) {
    const A = toXY(path[i], refLat);
    const B = toXY(path[i + 1], refLat);
    const abx = B.x - A.x;
    const aby = B.y - A.y;
    const apx = P.x - A.x;
    const apy = P.y - A.y;
    const lenSq = abx * abx + aby * aby;
    const t = lenSq > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq)) : 0;
    const cx = A.x + t * abx;
    const cy = A.y + t * aby;
    const dx = P.x - cx;
    const dy = P.y - cy;
    const perpDistM = Math.sqrt(dx * dx + dy * dy);

    if (perpDistM < best.perpDistM) {
      const segLen = cumM[i + 1] - cumM[i];
      best = { segIndex: i, perpDistM, alongM: cumM[i] + t * segLen };
    }
  }

  return best;
}

export interface Waypoint {
  coord: LatLng | null;
  /** 本指令轉向點的沿線距離（公尺）。 */
  alongM: number;
}

/**
 * 以 per-leg 的 `polylineIndex` 與 `legIndex` 把每個指令對到轉向點座標與沿線距離。
 * 超出範圍的索引會 clamp 在來源 leg 內，引擎永遠拿得到可用的 waypoint（SDD §6.3 不變量）。
 *
 * 大眾運輸上車指令的索引為 null 時錨定到該 leg 起點；下車與抵達錨定到終點；其他 null 沿用前一點。
 * 沒有可用 legIndex 的舊版／語音指令沿用舊的全域索引 fallback。waypoint 序列保持非遞減，
 * 這是選步驟時的前提。
 */
export function resolveWaypoints(
  instructions: NavInstruction[],
  { path, cumM, legRanges }: CumulativePath,
): Waypoint[] {
  if (path.length === 0) return [];
  const last = path.length - 1;
  let prevIdx = 0;
  return instructions.map((ins) => {
    const range = ins.legIndex == null ? undefined : legRanges[ins.legIndex];
    let idx: number;

    if (range && range.count > 0) {
      if (ins.polylineIndex != null) {
        const legIdx = Math.max(0, Math.min(range.count - 1, ins.polylineIndex));
        idx = range.start + legIdx;
      } else if (ins.type === 'transit_board') {
        idx = range.start;
      } else if (ins.type === 'transit_alight' || ins.type === 'arrive') {
        idx = range.start + range.count - 1;
      } else {
        idx = prevIdx;
      }
    } else {
      const fallbackIdx = ins.polylineIndex ?? prevIdx;
      idx = Math.max(0, Math.min(last, fallbackIdx));
    }

    const ci = Math.max(idx, prevIdx);
    prevIdx = ci;
    return {
      coord: path[ci] ?? null,
      alongM: cumM[ci] ?? 0,
    };
  });
}

/** 點到 polyline 的最小垂直距離（公尺），用局部平面投影。 */
export function pointToPolylineDistanceM(point: LatLng, polyline: LngLatTuple[]): number {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) {
    return haversineMeters(point, { lng: polyline[0][0], lat: polyline[0][1] });
  }

  const refLat = point.lat;
  const P = toXY(point, refLat);
  let minDistance = Infinity;

  for (let i = 0; i < polyline.length - 1; i++) {
    const A = toXY({ lng: polyline[i][0], lat: polyline[i][1] }, refLat);
    const B = toXY({ lng: polyline[i + 1][0], lat: polyline[i + 1][1] }, refLat);
    const abx = B.x - A.x;
    const aby = B.y - A.y;
    const apx = P.x - A.x;
    const apy = P.y - A.y;
    const lenSq = abx * abx + aby * aby;
    const t = lenSq > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq)) : 0;
    const cx = A.x + t * abx;
    const cy = A.y + t * aby;
    const dx = P.x - cx;
    const dy = P.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return minDistance;
}

/**
 * 只留下距路線 polyline `maxDistanceM` 內的事故。確保離路線很遠的事故（例如別的城市）
 * 不會出現在地圖 marker 與路線詳情提示。
 */
export function filterIncidentsAlongRoute<T extends { location?: { lat: number; lng: number } }>(
  incidents: T[] | undefined,
  polyline: LngLatTuple[] | undefined,
  maxDistanceM = 150,
): T[] {
  if (!incidents?.length || !polyline?.length) return [];
  return incidents.filter((incident) => {
    if (!incident?.location || !Number.isFinite(incident.location.lat) || !Number.isFinite(incident.location.lng)) {
      return false;
    }
    return pointToPolylineDistanceM(incident.location, polyline) <= maxDistanceM;
  });
}
