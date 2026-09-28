import { useEffect, useState } from 'react';

import { useAppTranslation } from '@/shared/i18n';

import { reverseGeocode } from '../api/reverseGeocode';
import { nominatimToPlaceResult } from '../domain/adapters';
import { toApiLang } from '../domain/lang';
import type { PlaceResult } from '../types/place';

interface UseReverseGeocodeResult {
  place: PlaceResult | null;
  loading: boolean;
  /** 反查失敗（或無結果）時仍要能顯示座標型地點面板（對齊 Web `?loc=` 的 `.catch()` 備援）。 */
  failed: boolean;
}

/**
 * 供 `(sheet)/loc/[coords].tsx` 使用：反查座標 → `nominatimToPlaceResult`。
 * 對齊 Web `ClientMap.tsx` 的 `?loc=` deep-link 與地圖點擊路徑（commit 5eadc71）：
 * 反查成功轉成 `PlaceResult`；失敗（或回傳 `null`）時 `failed: true`，
 * 呼叫端據此顯示座標本身（`"${lat}, ${lng}"`）作為備援地址。
 */
export function useReverseGeocode(lat: number | null, lng: number | null): UseReverseGeocodeResult {
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const { i18n } = useAppTranslation();
  const lang = toApiLang(i18n.language) ?? 'zh-TW';

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setPlace(null);
      setFailed(false);
      if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }
      setLoading(true);
      try {
        const formatted = await reverseGeocode({ lat, lng, lang, zoom: 18, signal: controller.signal });
        if (controller.signal.aborted) return;
        if (formatted) {
          setPlace(nominatimToPlaceResult(formatted));
        } else {
          setFailed(true);
        }
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [lat, lng, lang]);

  return { place, loading, failed };
}
