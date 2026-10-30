import { useEffect, useSyncExternalStore } from 'react';

import { searchVenuePlaces } from '../domain/venuePlace';
import { refreshVenuePlaceCatalog, venuePlaceCatalog } from './venuePlaceCatalog';

export function useVenuePlaceSuggestions(query: string) {
  const catalog = useSyncExternalStore(venuePlaceCatalog.subscribe, venuePlaceCatalog.getSnapshot, venuePlaceCatalog.getSnapshot);
  const active = query.trim().length > 0;
  useEffect(() => { if (active) void refreshVenuePlaceCatalog(false); }, [active]);
  return {
    suggestions: searchVenuePlaces(catalog.models, query),
    loading: active && (catalog.loading || (!catalog.updatedAt && !catalog.failed)),
    failed: active && catalog.failed,
    retry: () => { void refreshVenuePlaceCatalog(); },
  };
}
