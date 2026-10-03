import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { useAppTranslation } from '@/shared/i18n';
import { ErrorState } from '@/shared/ui';

import PlaceDetailPanel from '../components/PlaceDetailPanel';
import PlaceDetailSkeleton from '../components/PlaceDetailSkeleton';
import { usePlaceDetail } from '../hooks/usePlaceDetail';
import { usePlaceUiStore } from '../store/placeUiStore';

/**
 * `(sheet)/place/[id]` — 對應 Web `?place=` deep link／自動完成選定地點。
 * `id` 一律是目前格式（`osm:*`／`google:*`），`coord:` 座標型 id 不會走這條路由
 * （見 `domain/placeId.ts` 的不變量），而是 `(sheet)/loc/[coords]`。
 */
export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useAppTranslation();
  const { place, loading, error } = usePlaceDetail(id ?? null);
  const setSelectedPlace = usePlaceUiStore((state) => state.setSelectedPlace);

  useEffect(() => {
    if (place) {
      const [lng, lat] = place.location.coordinates;
      setSelectedPlace({ kind: 'place', place, position: { lat, lng } });
    }
    return () => setSelectedPlace(null);
  }, [place, setSelectedPlace]);

  return (
    <>
      <Stack.Screen options={{ title: place?.name ?? t('placeInfoLabel') }} />
      {loading ? (
        <PlaceDetailSkeleton />
      ) : error || !place ? (
        <ErrorState title={t('nativePlaceLoadError')} systemImage="exclamationmark.triangle" />
      ) : (
        <PlaceDetailPanel entry={{ kind: 'place', place, position: { lat: place.location.coordinates[1], lng: place.location.coordinates[0] } }} />
      )}
    </>
  );
}
