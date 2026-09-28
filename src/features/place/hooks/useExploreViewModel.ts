import { router } from 'expo-router';
import { useState } from 'react';

import { mapCamera, useUserLocationStore } from '@/features/map';
import { useAppTranslation } from '@/shared/i18n';

import { getPlaceDetails } from '../api/placeSearch';
import { toApiLang } from '../domain/lang';
import { placeDisplayName } from '../domain/searchHistory';
import { usePlaceUiStore } from '../store/placeUiStore';
import { useSavedPlacesStore } from '../store/savedPlacesStore';
import type { AutocompleteItem, PlaceDetail } from '../types/place';
import { placeDetailHref } from './placeRoute';
import { useAutocomplete } from './useAutocomplete';

export interface ExploreRow {
  key: string;
  title: string;
  subtitle?: string;
  /** 自動完成結果解析中（呼叫 `getPlaceDetails`）。 */
  resolving: boolean;
  /** 任何一列正在 resolving 時，其餘列一併停用（對齊原本 `resolvingId` 互斥行為）。 */
  disabled: boolean;
  onPress: () => void;
}

export type ExploreMode = 'history' | 'results';

export interface ExploreViewModel {
  query: string;
  onQueryChange: (text: string) => void;
  /** 自動完成請求 in-flight。 */
  loading: boolean;
  mode: ExploreMode;
  historyRows: ExploreRow[];
  resultRows: ExploreRow[];
  onOpenNearby: () => void;
  onOpenSaved: () => void;
  labels: {
    searchPlaceholder: string;
    nearbyA11y: string;
    savedPlaces: string;
    searchHistory: string;
    searchResults: string;
    noResults: string;
  };
}

/**
 * 搜尋面板（`(sheet)/explore`）的 view-model：把原本 `ExplorePanel.tsx` 裡的
 * router／store／i18n／自動完成解析邏輯抽出來，讓 `ExplorePanel` 只剩下
 * 呈現。sheet 最低 detent 只露出約 15% 畫面，所以搜尋框永遠是第一列
 * （由呈現層負責排版，這裡不涉及）。
 */
export function useExploreViewModel(): ExploreViewModel {
  const { t, i18n } = useAppTranslation();
  const [query, setQuery] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const userLocation = useUserLocationStore((state) => state.position);
  const searchHistory = useSavedPlacesStore((state) => state.searchHistory);
  const addSearchHistory = useSavedPlacesStore((state) => state.addSearchHistory);
  const setSelectedPlace = usePlaceUiStore((state) => state.setSelectedPlace);
  const { suggestions, loading, sessionToken, resetSession } = useAutocomplete(query, userLocation ?? undefined);

  const openPlace = (entry: PlaceDetail) => {
    addSearchHistory(entry);
    setSelectedPlace(entry);
    mapCamera.flyTo([entry.position.lng, entry.position.lat], 17);
    router.push(placeDetailHref(entry));
  };

  const handlePickSuggestion = async (item: AutocompleteItem) => {
      if (resolvingId) return;
      setResolvingId(item.id);
      try {
        const res = await getPlaceDetails(
          item.id,
          { sessiontoken: sessionToken, lat: userLocation?.lat, lng: userLocation?.lng, lang: toApiLang(i18n.language) },
          undefined,
        );
        if (res.data) {
          const place = res.data;
          const [lng, lat] = place.location.coordinates;
          openPlace({ kind: 'place', place, position: { lat, lng } });
          resetSession();
          setQuery('');
        }
      } catch (error) {
        console.warn('[place] resolve suggestion failed', error);
      } finally {
        setResolvingId(null);
      }
  };

  const handlePickHistory = (entry: PlaceDetail) => {
    openPlace(entry);
    setQuery('');
  };

  const historyRows: ExploreRow[] = searchHistory.map((entry, index) => ({
    key: `${placeDisplayName(entry)}-${index}`,
    title: placeDisplayName(entry),
    resolving: false,
    disabled: false,
    onPress: () => handlePickHistory(entry),
  }));

  const resultRows: ExploreRow[] = suggestions.map((item) => ({
    key: item.id,
    title: item.primaryText,
    subtitle: item.secondaryText ?? undefined,
    resolving: resolvingId === item.id,
    disabled: resolvingId !== null,
    onPress: () => void handlePickSuggestion(item),
  }));

  return {
    query,
    onQueryChange: setQuery,
    loading,
    mode: query.trim() === '' ? 'history' : 'results',
    historyRows,
    resultRows,
    onOpenNearby: () => router.push('/nearby'),
    onOpenSaved: () => router.push('/saved'),
    labels: {
      searchPlaceholder: t('searchPlaceHolder'),
      nearbyA11y: t('nearbyA11y'),
      savedPlaces: t('savedPlaces'),
      searchHistory: t('searchHistory'),
      searchResults: t('searchResults'),
      noResults: t('nativeNoSearchResults'),
    },
  };
}
