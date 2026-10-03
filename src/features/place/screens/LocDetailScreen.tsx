import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { useAppTranslation } from '@/shared/i18n';
import { ErrorState } from '@/shared/ui';

import PlaceDetailPanel from '../components/PlaceDetailPanel';
import PlaceDetailSkeleton from '../components/PlaceDetailSkeleton';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import { usePlaceUiStore } from '../store/placeUiStore';
import type { PlaceDetail, PlaceResult } from '../types/place';

/**
 * `(sheet)/loc/[coords]` — 對應 Web 地圖點擊與 `?loc=lat,lng` deep link
 * （`ClientMap.tsx:387-429`／`307-338`，commit 5eadc71）：反查地址；失敗時
 * 仍要能顯示座標本身的地點面板（`"${lat}, ${lng}"` 備援地址），而不是
 * 整個面板空白。`coords` 參數格式為 `"lat,lng"`（`MapScreen` 點擊時已組好）。
 */
function buildEntry(
  validCoords: boolean,
  lat: number,
  lng: number,
  place: PlaceResult | null,
  failed: boolean,
): PlaceDetail | null {
  if (!validCoords) return null;
  if (place) return { kind: 'place', place, position: { lat, lng } };
  if (failed) return { kind: 'coordinate', address: `${lat}, ${lng}`, position: { lat, lng } };
  return null;
}

export default function LocDetailScreen() {
  const { coords } = useLocalSearchParams<{ coords: string }>();
  const { t } = useAppTranslation();
  const setSelectedPlace = usePlaceUiStore((state) => state.setSelectedPlace);

  const parts = (coords ?? '').split(',').map(Number);
  const lat = parts[0] ?? Number.NaN;
  const lng = parts[1] ?? Number.NaN;
  const validCoords = Number.isFinite(lat) && Number.isFinite(lng);

  const { place, loading, failed } = useReverseGeocode(validCoords ? lat : null, validCoords ? lng : null);

  const entry = buildEntry(validCoords, lat, lng, place, failed);

  // 依賴原始值而非每次 render 重建的 entry 物件
  useEffect(() => {
    setSelectedPlace(buildEntry(validCoords, lat, lng, place, failed));
    return () => setSelectedPlace(null);
  }, [validCoords, lat, lng, place, failed, setSelectedPlace]);

  return (
    <>
      <Stack.Screen options={{ title: entry?.kind === 'place' ? entry.place.name : t('placeInfoLabel') }} />
      {!validCoords ? (
        <ErrorState title={t('nativePlaceLoadError')} systemImage="exclamationmark.triangle" />
      ) : !entry || loading ? (
        <PlaceDetailSkeleton />
      ) : (
        <PlaceDetailPanel entry={entry} />
      )}
    </>
  );
}
