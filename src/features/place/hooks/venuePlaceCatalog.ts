import { loadVenue, loadVenues } from '@/features/indoor/api/venueApi';
import type { VenueDetail } from '@/features/indoor/types/venue';

import { toVenuePlaceDetail, type VenuePlaceIdentity } from '../domain/venuePlace';
import type { VenuePlaceDetail } from '../types/place';

interface CatalogSnapshot { models: VenueDetail[]; loading: boolean; failed: boolean; updatedAt: number }
let snapshot: CatalogSnapshot = { models: [], loading: false, failed: false, updatedAt: 0 };
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const MAX_AGE_MS = 5 * 60 * 1000;

function publish(next: CatalogSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export const venuePlaceCatalog = {
  getSnapshot: () => snapshot,
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
};

/** 共用搜尋索引，失敗不影響普通地點搜尋；最多同時載入四個場館。 */
export function refreshVenuePlaceCatalog(force = true): Promise<void> {
  if (inFlight) return inFlight;
  if (!force && snapshot.updatedAt && Date.now() - snapshot.updatedAt < MAX_AGE_MS) return Promise.resolve();
  publish({ ...snapshot, loading: true, failed: false });
  inFlight = (async () => {
    try {
      const catalog = await loadVenues();
      const models: VenueDetail[] = [];
      let failed = false;
      let nextIndex = 0;
      await Promise.all(Array.from({ length: Math.min(4, catalog.length) }, async () => {
        while (nextIndex < catalog.length) {
          const venue = catalog[nextIndex++];
          const cached = snapshot.models.find((model) => model.venueId === venue.venueId);
          try { models.push(cached?.version === venue.version ? cached : await loadVenue(venue.venueId)); }
          catch { failed = true; if (cached) models.push(cached); }
        }
      }));
      const ordered = catalog.flatMap((venue) => {
        const loaded = models.find((model) => model.venueId === venue.venueId);
        const latest = snapshot.models.find((model) => model.venueId === venue.venueId);
        const model = latest && (!loaded || latest.version > loaded.version) ? latest : loaded;
        return model ? [model] : [];
      });
      publish({ models: ordered, loading: false, failed, updatedAt: Date.now() });
    } catch {
      publish({ ...snapshot, loading: false, failed: true, updatedAt: 0 });
    } finally { inFlight = null; }
  })();
  return inFlight;
}

/** 選取、歷史與深層連結都重讀場館，避免舊版房號或已移除地點成為規劃端點。 */
export async function resolveVenuePlace(identity: VenuePlaceIdentity, signal?: AbortSignal): Promise<VenuePlaceDetail | null> {
  const detail = await loadVenue(identity.venueId, signal);
  if (signal?.aborted) return null;
  const current = snapshot.models.find((model) => model.venueId === detail.venueId);
  if (!current || current.version <= detail.version) {
    publish({ ...snapshot, models: [...snapshot.models.filter((model) => model.venueId !== detail.venueId), detail] });
  }
  const place = detail.places.find((item) => item.id === identity.placeId);
  return place ? toVenuePlaceDetail(detail, place) : null;
}
