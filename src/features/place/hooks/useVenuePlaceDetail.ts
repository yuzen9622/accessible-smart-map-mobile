import { useEffect, useState } from 'react';

import { parseVenuePlaceId } from '../domain/venuePlace';
import type { VenuePlaceDetail } from '../types/place';
import { resolveVenuePlace } from './venuePlaceCatalog';

export function useVenuePlaceDetail(id: string | null) {
  const [result, setResult] = useState<{ id: string | null; entry: VenuePlaceDetail | null; error: boolean }>({ id: null, entry: null, error: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const identity = id ? parseVenuePlaceId(id) : null;
    if (!id || !identity) return;
    const controller = new AbortController();
    void resolveVenuePlace(identity, controller.signal).then((entry) => {
      if (!controller.signal.aborted) setResult({ id, entry, error: !entry });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ id, entry: null, error: true });
    });
    return () => controller.abort();
  }, [id, attempt]);
  const current = id === result.id;
  return {
    entry: current ? result.entry : null,
    loading: Boolean(id && parseVenuePlaceId(id) && !current),
    error: Boolean(id && (!parseVenuePlaceId(id) || (current && result.error))),
    retry: () => { setResult({ id: null, entry: null, error: false }); setAttempt((value) => value + 1); },
  };
}
