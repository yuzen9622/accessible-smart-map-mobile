import type {
  BusArrivalItem,
  BusDirection,
  RouteDetailDirection,
  RouteDetailStop,
  TrackableBusDirection,
} from '../types/transit';
import { equalStopName } from './busLegStops';

/** TDX 公車方向的唯一合法值；API parser 與導覽參數共用這一份規則。 */
export function isBusDirection(value: unknown): value is BusDirection {
  return value === 0 || value === 1 || value === 2 || value === 10 || value === 255;
}

/** 255（未知）不能據此判斷車輛往哪邊開，不做搭乘追蹤、提醒與車輛配對。 */
export function isTrackableDirection(direction: BusDirection): direction is TrackableBusDirection {
  return direction !== 255;
}

/**
 * 路線詳情裡的一個可選項：實際回傳的一組站序，以 `(subRouteUid, direction)` 識別。
 * 同一方向可以有多個支線，絕不只靠 `direction` 合併。
 */
export interface DirectionOption {
  /** 選擇的識別字串（`uid|direction`）；同一組重複時加 `#序號`。 */
  key: string;
  /** 在 API 回傳 `directions` 中的位置。 */
  index: number;
  direction: BusDirection;
  subRouteUid?: string;
  subRouteName?: string;
  /** 同一 `(subRouteUid, direction)` 出現多次：無法判斷車輛屬於哪一組，不能追蹤。 */
  ambiguous: boolean;
  /** 整份資料中這個方向只有這一組，沒有 UID 的紀錄也不可能是別組。 */
  exclusive: boolean;
}

/** 用來把車輛、到站紀錄對回某一組站序的條件。 */
export interface RideSelection {
  direction: BusDirection;
  subRouteUid?: string;
  exclusive: boolean;
}

export function buildDirectionOptions(directions: readonly RouteDetailDirection[]): DirectionOption[] {
  const seen = new Map<string, number>();
  const sameDirection = new Map<BusDirection, number>();
  for (const d of directions) sameDirection.set(d.direction, (sameDirection.get(d.direction) ?? 0) + 1);
  const baseKeys = directions.map((d) => `${d.subRouteUid ?? ''}|${d.direction}`);
  const baseCount = new Map<string, number>();
  for (const k of baseKeys) baseCount.set(k, (baseCount.get(k) ?? 0) + 1);

  return directions.map((d, index) => {
    const base = baseKeys[index];
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return {
      key: n === 0 ? base : `${base}#${n}`,
      index,
      direction: d.direction,
      subRouteUid: d.subRouteUid,
      subRouteName: d.subRouteName,
      ambiguous: (baseCount.get(base) ?? 0) > 1,
      exclusive: sameDirection.get(d.direction) === 1,
    };
  });
}

export function selectionOf(option: DirectionOption): RideSelection {
  return { direction: option.direction, subRouteUid: option.subRouteUid, exclusive: option.exclusive };
}

export interface DirectionPreference {
  /** 使用者上次選的 {@link DirectionOption.key}；資料更新後可能已不存在。 */
  key?: string | null;
  /** 導覽參數帶來的支線。 */
  subRouteUid?: string;
  /** 導覽參數帶來的方向。 */
  direction?: BusDirection | null;
}

function pickFromScope(scope: readonly DirectionOption[]): DirectionOption | null {
  return scope.find((o) => o.direction === 0) ?? scope.find((o) => o.direction !== 255) ?? scope[0] ?? null;
}

/**
 * 保留仍存在的選擇；失效時優先目前（導覽）選定支線的 0，再該支線第一個非 255，最後 255；無資料 null。
 * 導覽只帶方向、沒有支線時，只有方向唯一才採用，不任意挑一支混合。
 */
export function resolveDirectionOption(
  options: readonly DirectionOption[],
  preference: DirectionPreference = {},
): DirectionOption | null {
  if (options.length === 0) return null;
  const { key, direction } = preference;
  if (key) {
    const kept = options.find((o) => o.key === key);
    if (kept) return kept;
  }
  const staleUid = key && key.includes('|') ? key.slice(0, key.indexOf('|')) : '';
  const uid = preference.subRouteUid || staleUid || undefined;

  if (!key && direction !== undefined && direction !== null) {
    const candidates = options.filter(
      (o) => o.direction === direction && (uid === undefined || o.subRouteUid === uid),
    );
    if (candidates.length === 1 || (uid !== undefined && candidates.length > 0)) return candidates[0];
  }

  const scoped = uid === undefined ? [] : options.filter((o) => o.subRouteUid === uid);
  return pickFromScope(scoped.length > 0 ? scoped : options);
}

export type DirectionTitle =
  | { kind: 'headsign'; name: string }
  | { kind: 'loop' | 'circular' | 'unknown' };

/**
 * 方向的標題。0／1 沿用「往終點／往起點」：搜尋結果的起訖站只在該方向唯一時才採用
 * （同方向有多個支線時終點各不相同）；2／10／255 不套去程終點。
 */
export function directionTitle(
  directions: readonly RouteDetailDirection[],
  option: DirectionOption,
  route: { departure?: string; destination?: string },
): DirectionTitle {
  if (option.direction === 2) return { kind: 'loop' };
  if (option.direction === 10) return { kind: 'circular' };
  if (option.direction === 255) return { kind: 'unknown' };
  const terminal = directions[option.index]?.stops.at(-1)?.name ?? '';
  const preferred = option.direction === 0 ? route.destination : route.departure;
  return { kind: 'headsign', name: (option.exclusive && preferred) || terminal };
}

export function stopsOfOption(directions: readonly RouteDetailDirection[], index: number | null): RouteDetailStop[] {
  return index === null ? [] : (directions[index]?.stops ?? []);
}

/**
 * 地圖上這組站序的線形（`[lng, lat]`）：優先用後端的 TDX 線形；沒有時退回站序直線連接。
 * 與 {@link stopsOfOption} 取同一個物件（`index` 是 {@link DirectionOption.index}），線形和站點才會屬於同一個子路線。
 */
export function routePathOfOption(
  directions: readonly RouteDetailDirection[],
  index: number | null,
): [number, number][] {
  const picked = index === null ? undefined : directions[index];
  if (!picked) return [];
  if (picked.polyline && picked.polyline.length >= 2) return picked.polyline;
  return picked.stops.map((s) => [s.lng, s.lat]);
}

/**
 * 車輛／到站紀錄是否屬於這組站序（可含 255，供地圖顯示用）：方向必須相同；兩邊都有支線 ID 時必須相等。
 * 只有一邊有 ID（或兩邊都沒有）時，該方向必須只有一組站序才算，否則無法證明沒有混到別的支線。
 */
export function belongsToSelection(item: { direction: BusDirection; subRouteUid?: string }, sel: RideSelection): boolean {
  if (item.direction !== sel.direction) return false;
  if (item.subRouteUid && sel.subRouteUid) return item.subRouteUid === sel.subRouteUid;
  return sel.exclusive;
}

/** {@link belongsToSelection}，且方向必須可追蹤：255（未知）一律不配對，不能據此判斷車往哪邊開。 */
export function matchesSelection(item: { direction: BusDirection; subRouteUid?: string }, sel: RideSelection): boolean {
  return sel.direction !== 255 && belongsToSelection(item, sel);
}

export interface NextArrival {
  /** 與 {@link estimateMinutes} 同一筆紀錄的車牌；TDX 尚未派車時沒有。 */
  plateNumb?: string;
  estimateMinutes: number;
}

/**
 * 某站、某組站序下最快的一筆到站紀錄：站名（正規化後）、支線、方向都要對，ETA 必須是有限的非負數。
 * 車牌取自同一筆紀錄，不借用別筆。
 */
export function pickNextArrival(
  arrivals: readonly BusArrivalItem[],
  stopName: string,
  sel: RideSelection,
): NextArrival | null {
  let best: BusArrivalItem | null = null;
  for (const a of arrivals) {
    const eta = a.estimateMinutes;
    if (typeof eta !== 'number' || !Number.isFinite(eta) || eta < 0) continue;
    if (!equalStopName(a.stopName, stopName) || !matchesSelection(a, sel)) continue;
    if (!best || eta < (best.estimateMinutes ?? Number.POSITIVE_INFINITY)) best = a;
  }
  if (!best || best.estimateMinutes === null) return null;
  const plate = best.plateNumb && best.plateNumb !== '-1' ? best.plateNumb : undefined;
  return { plateNumb: plate, estimateMinutes: best.estimateMinutes };
}

/** 失去可用即時資訊時：保留靜態站序，但清掉即時 ETA 與狀態，不留假的即時資料。 */
export function stripLiveEta(directions: readonly RouteDetailDirection[]): RouteDetailDirection[] {
  return directions.map((d) => ({
    ...d,
    stops: d.stops.map((s) => ({ ...s, estimateMinutes: null, statusLabel: '' })),
  }));
}
