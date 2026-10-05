// 移植自 Web `src/lib/transit/busRouteDetailCache.ts`（commit 5eadc71），邏輯逐行保留。
// 放在 api 層：它是 `getBusRouteDetail` 的去重快取，不含 UI 或 store。

import type { RouteDetailDirection } from '../types/transit';
import { getBusRouteDetail } from './transit';

/**
 * Process-wide cache for `/transit/bus/route-detail`.
 *
 * Two callers want the same payload at almost the same moment: selecting a
 * route prefetches every BUS leg's stop ETAs, and expanding one of those legs
 * then polls it. Without a shared cache the expand would refetch from scratch
 * and render placeholder rows again — the very flash this cache exists to kill.
 *
 * `peekRouteDetail` is the synchronous half: a hook can seed its initial state
 * from an already-warm entry so the first render after expanding is real data,
 * not a loading state.
 */

const TTL_MS = 15_000;

interface Entry {
  at: number;
  promise: Promise<RouteDetailDirection[] | null>;
  /** Set once the promise resolves, so `peekRouteDetail` can read it. */
  value?: RouteDetailDirection[] | null;
  settled: boolean;
}

const cache = new Map<string, Entry>();

/** 只有實際對後端送出 subRouteUid 時 key 才帶它：不同子路線的 payload 不共用。 */
export function routeDetailKey(routeName: string, city: string, subRouteUid?: string): string {
  return subRouteUid ? `${city}::${routeName}::${subRouteUid}` : `${city}::${routeName}`;
}

/** The cached directions when a fresh entry exists, else null. Never fetches. */
export function peekRouteDetail(
  routeName: string,
  city: string,
  subRouteUid?: string,
): RouteDetailDirection[] | null {
  const entry = cache.get(routeDetailKey(routeName, city, subRouteUid));
  if (!entry?.settled) return null;
  if (Date.now() - entry.at > TTL_MS) return null;
  return entry.value ?? null;
}

/**
 * Fetch the route's stop list + ETAs, deduplicated.
 *
 * Within {@link TTL_MS} the cached promise is returned as-is. `force` (used by
 * the poll loop) bypasses the age check but still joins an in-flight request,
 * so N legs of the same line never issue N requests.
 *
 * Never rejects: a failed lookup resolves to null and is never cached. The
 * receipt time `at` only moves when a fetch succeeds — a failed forced refresh
 * puts the previous settled entry back untouched, so stale data never looks
 * freshly received (and expires on its original schedule).
 */
export function fetchRouteDetailCached(
  routeName: string,
  city: string,
  opts?: { force?: boolean; subRouteUid?: string },
): Promise<RouteDetailDirection[] | null> {
  const key = routeDetailKey(routeName, city, opts?.subRouteUid);
  const existing = cache.get(key);

  if (existing) {
    const fresh = Date.now() - existing.at <= TTL_MS;
    // An in-flight request is always joined, even when forcing.
    if (!existing.settled || (fresh && !opts?.force)) return existing.promise;
  }

  const previous = existing?.settled ? existing : undefined;
  const entry: Entry = {
    at: Date.now(),
    settled: false,
    promise: Promise.resolve(null),
  };

  const fail = () => {
    if (cache.get(key) !== entry) return;
    if (previous) cache.set(key, previous);
    else cache.delete(key);
  };

  entry.promise = (async () => {
    try {
      const res = await getBusRouteDetail(routeName, city, undefined, opts?.subRouteUid);
      const directions = res.ok ? res.data?.directions : undefined;
      if (!directions) {
        fail();
        return null;
      }
      entry.value = directions;
      entry.settled = true;
      entry.at = Date.now();
      return directions;
    } catch {
      fail();
      return null;
    }
  })();

  cache.set(key, entry);
  return entry.promise;
}

/** Test-only escape hatch. */
export function __clearRouteDetailCache(): void {
  cache.clear();
}
