import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { useAppTranslation } from '@/shared/i18n';
import { ErrorState, HeaderCloseButton } from '@/shared/ui';

import PlaceDetailPanel from '../components/PlaceDetailPanel';
import PlaceDetailSkeleton from '../components/PlaceDetailSkeleton';
import { usePlaceDetail } from '../hooks/usePlaceDetail';
import { useVenuePlaceDetail } from '../hooks/useVenuePlaceDetail';
import { usePlaceUiStore } from '../store/placeUiStore';

/**
 * `(sheet)/place/[id]` — 對應 Web `?place=` deep link／自動完成選定地點。
 * `osm:*`／`google:*` 讀一般地點，`venue:*` 依場館與地點身分讀室內資料；
 * 座標型地點走 `(sheet)/loc/[coords]`。
 */
export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useAppTranslation();
  const venueId = id?.startsWith('venue:') ? id : null;
  const outdoor = usePlaceDetail(venueId ? null : id ?? null);
  const venue = useVenuePlaceDetail(venueId);
  const { place } = outdoor;
  const entry = useMemo(() => venueId ? venue.entry : place ? { kind: 'place' as const, place, position: { lat: place.location.coordinates[1], lng: place.location.coordinates[0] } } : null, [venueId, venue.entry, place]);
  const loading = venueId ? venue.loading : outdoor.loading;
  const error = venueId ? venue.error : outdoor.error;
  const setSelectedPlace = usePlaceUiStore((state) => state.setSelectedPlace);

  useEffect(() => {
    if (entry) setSelectedPlace(entry);
    return () => setSelectedPlace(null);
  }, [entry, setSelectedPlace]);

  return (
    <>
      {/* 導覽列標題固定用通用標籤，不重複內文已經有的大標地名（使用者回饋 2026-10-23，參考設計圖二）。 */}
      <Stack.Screen options={{ title: t('placeInfoLabel'), headerLeft: () => <HeaderCloseButton /> }} />
      {loading ? (
        <PlaceDetailSkeleton />
      ) : error || !entry ? (
        <ErrorState title={t('nativePlaceLoadError')} systemImage="exclamationmark.triangle" retry={venueId ? { label: t('retry'), onPress: venue.retry } : undefined} />
      ) : (
        <PlaceDetailPanel entry={entry} />
      )}
    </>
  );
}
