import { useEffect, useState } from 'react';

import { fetchNearbyA11y, isValidPlaceBounds, type NearbyA11yData } from '../api/nearbyA11y';
import type { PlaceBounds } from '../types/place';

type NearbyState =
  | { status: 'idle' | 'loading'; data: null }
  | { status: 'error'; data: null }
  | { status: 'success'; data: NearbyA11yData };

/** 一次查詢同時供無障礙狀態與附近設施清單使用。 */
export function useNearbyA11ySummary(
  point: { lat: number; lng: number } | null,
  bounds: PlaceBounds | null | undefined,
  lang: string | undefined,
): NearbyState {
  const lat = point?.lat;
  const lng = point?.lng;
  const bbox = isValidPlaceBounds(bounds) ? bounds.join(',') : '';
  const key = lat !== undefined && lng !== undefined && Number.isFinite(lat) && Number.isFinite(lng)
    ? `${lat},${lng}|${bbox}|${lang ?? ''}`
    : '';
  const [state, setState] = useState<{ key: string; result: NearbyState }>({ key: '', result: { status: 'idle', data: null } });

  useEffect(() => {
    if (!key || lat === undefined || lng === undefined) return;
    const controller = new AbortController();
    const parts = bbox.split(',').map(Number);
    const placeBounds: PlaceBounds | null = bbox ? [parts[0], parts[1], parts[2], parts[3]] : null;
    fetchNearbyA11y({ point: { lat, lng }, bounds: placeBounds, lang, signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, result: { status: 'success', data } });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, result: { status: 'error', data: null } });
      });
    return () => controller.abort();
  }, [key, lat, lng, bbox, lang]);

  const result: NearbyState = !key ? { status: 'idle', data: null }
    : state.key === key ? state.result : { status: 'loading', data: null };
  return result;
}
