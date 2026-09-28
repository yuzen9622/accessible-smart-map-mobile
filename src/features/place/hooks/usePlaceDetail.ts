import { useEffect, useState } from 'react';

import { useAppTranslation } from '@/shared/i18n';

import { getPlaceDetails } from '../api/placeSearch';
import { toApiLang } from '../domain/lang';
import { isCoordPlaceId } from '../domain/placeId';
import type { PlaceResult } from '../types/place';

interface UsePlaceDetailOptions {
  sessiontoken?: string;
  location?: { lat: number; lng: number };
}

interface UsePlaceDetailResult {
  place: PlaceResult | null;
  loading: boolean;
  error: boolean;
}

/**
 * 移植自 Web `getPlaceDetails` 呼叫端邏輯（`PlaceInput.tsx`／`ClientMap.tsx`
 * `?place=` deep link，commit 5eadc71）。**不變量**：`coord:` 開頭的 id 不得
 * 呼叫 `/search/details/:id`（後端 400），此 hook 直接跳過請求並回傳
 * `place: null`——呼叫端（`(sheet)/place/[id].tsx`）不會用這個 hook 處理
 * `coord:` id，而是走 `useReverseGeocode`。
 */
export function usePlaceDetail(id: string | null, options: UsePlaceDetailOptions = {}): UsePlaceDetailResult {
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const { i18n } = useAppTranslation();
  const lang = toApiLang(i18n.language);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setPlace(null);
      setError(false);
      if (!id || isCoordPlaceId(id)) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await getPlaceDetails(
          id,
          { sessiontoken: options.sessiontoken, lat: options.location?.lat, lng: options.location?.lng, lang },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        if (res.data) {
          setPlace(res.data);
        } else {
          setError(true);
        }
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [id, lang, options.sessiontoken, options.location?.lat, options.location?.lng]);

  return { place, loading, error };
}
