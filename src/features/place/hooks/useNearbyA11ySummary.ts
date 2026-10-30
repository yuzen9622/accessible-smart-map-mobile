import { useEffect, useState } from 'react';

import { fetchNearbyA11ySummary } from '../api/nearbyA11y';
import type { NearbyA11ySummary, PlaceBounds, PlaceResult } from '../types/place';

/**
 * 地點範圍（Google viewport）內的附近設施分類數量；車站、校園的設施常離地標點
 * 超過 150 m，所以有範圍就帶範圍查。失敗或舊後端時為 null。
 */
export function useNearbyA11ySummary(place: PlaceResult | null): NearbyA11ySummary | null {
  const [lng, lat] = place?.location.coordinates ?? [Number.NaN, Number.NaN];
  // 以字串當依賴，place 物件身分變動但座標／範圍相同時不重查
  const bbox = place?.bounds ? place.bounds.join(',') : '';
  const valid = Boolean(place) && Number.isFinite(lat) && Number.isFinite(lng);
  const key = valid ? `${lat},${lng}|${bbox}` : '';
  const [state, setState] = useState<{ key: string; summary: NearbyA11ySummary | null }>({ key: '', summary: null });

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const bounds = bbox ? (bbox.split(',').map(Number) as PlaceBounds) : null;
    fetchNearbyA11ySummary({ lat, lng }, bounds, controller.signal)
      .then((summary) => {
        if (!controller.signal.aborted) setState({ key, summary });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, summary: null });
      });
    return () => controller.abort();
  }, [key, lat, lng, bbox]);

  return state.key === key ? state.summary : null;
}
