import type { RouteDetailDirection, RouteDetailStop } from '../types/transit';

export interface DirectionLabels {
  /** 方向 0 的終點（「往 destination」）。 */
  destination: string;
  /** 方向 1 的終點（「往 departure」）。 */
  departure: string;
}

/**
 * 對齊 Web：優先用搜尋結果帶來的起訖站；從站牌進入時沒有起訖，改用各方向的最後一站。
 */
export function resolveDirectionLabels(
  directions: readonly RouteDetailDirection[],
  route: { departure?: string; destination?: string },
): DirectionLabels {
  const terminal = (d: 0 | 1) => directions.find((x) => x.direction === d)?.stops.at(-1)?.name ?? '';
  return {
    destination: route.destination || terminal(0),
    departure: route.departure || terminal(1),
  };
}

/** 預設方向：有 0 用 0，否則第一個有的方向；沒有任何方向回 null。 */
export function defaultDirection(directions: readonly RouteDetailDirection[]): 0 | 1 | null {
  if (directions.some((d) => d.direction === 0)) return 0;
  return directions[0]?.direction ?? null;
}

export function stopsOfDirection(directions: readonly RouteDetailDirection[], direction: 0 | 1 | null): RouteDetailStop[] {
  if (direction === null) return [];
  return directions.find((d) => d.direction === direction)?.stops ?? [];
}

/**
 * 地圖上這個方向的路線線形（`[lng, lat]`）：優先用後端的 TDX 線形；沒有時退回站序直線連接。
 * 與 `stopsOfDirection` 取同一個方向物件，線形和站點才會屬於同一個子路線。
 */
export function routePathOfDirection(
  directions: readonly RouteDetailDirection[],
  direction: 0 | 1 | null,
): [number, number][] {
  if (direction === null) return [];
  const picked = directions.find((d) => d.direction === direction);
  if (!picked) return [];
  if (picked.polyline && picked.polyline.length >= 2) return picked.polyline;
  return picked.stops.map((s) => [s.lng, s.lat]);
}
