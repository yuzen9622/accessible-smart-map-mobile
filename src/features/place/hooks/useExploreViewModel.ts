import { router } from 'expo-router';
import { useState } from 'react';
import { Keyboard, useWindowDimensions } from 'react-native';

import {
  mapCamera,
  sheetBottomInset,
  useMapUiStore,
  useNearbyViewModel,
  useUserLocationStore,
  type NearbyRow,
} from '@/features/map';
import { selectIsLoggedIn, useAuthStore } from '@/features/auth';
import { useAppTranslation } from '@/shared/i18n';

import { getPlaceDetails } from '../api/placeSearch';
import { toApiLang } from '../domain/lang';
import { placeKey } from '../domain/placeKey';
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

export interface ExploreNearbyCard {
  key: string;
  title: string;
  distanceText: string;
  iconName: 'elevator' | 'ramp' | 'toilet' | 'parking' | 'mapPin';
  accessibilityLabel: string;
  onPress: () => void;
}

export interface ExploreQuickAction {
  key: 'plan' | 'bus' | 'nearby' | 'saved' | 'hazard';
  label: string;
  iconName: 'navigation' | 'bus' | 'accessibility' | 'bookmark' | 'alert';
  onPress: () => void;
}

const NEARBY_CARD_LIMIT = 6;
const SAVED_ROW_LIMIT = 5;
/** 對齊 Web `HomeContent.tsx`：收藏超過 3 筆才顯示「查看全部」 */
const SAVED_VIEW_ALL_THRESHOLD = 3;

function nearbyIconName(category: NearbyRow['category']): ExploreNearbyCard['iconName'] {
  switch (category) {
    case 'parking':
      return 'parking';
    case 'elevator':
      return 'elevator';
    case 'ramp':
      return 'ramp';
    case 'toilet':
      return 'toilet';
    default:
      return 'mapPin';
  }
}

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
  /** sheet 展開（half/full）時才顯示品牌列；peek 只露搜尋框（SDD §4.5）。 */
  showBrand: boolean;
  /** 非 ready 或為空 → `cards = []` */
  nearby: { title: string; cards: ExploreNearbyCard[] };
  /** 恰兩項，`onPress` 與 `onOpenNearby`／`onOpenSaved` 是同一函式 */
  quickActions: ExploreQuickAction[];
  /** 收藏地點前 5 筆 */
  savedRows: ExploreRow[];
  savedViewAll: { label: string; onPress: () => void } | null;
  /** 搜尋框右側的帳號／設定按鈕（Apple 地圖的頭像位置）；已登入顯示名字首字 */
  account: { label: string; initial: string | null; onPress: () => void };
  labels: {
    searchPlaceholder: string;
    nearbyA11y: string;
    savedPlaces: string;
    searchHistory: string;
    searchResults: string;
    noResults: string;
    appTitle: string;
    recentSearches: string;
    quickActions: string;
    savedPlacesTitle: string;
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
  const loggedIn = useAuthStore(selectIsLoggedIn);
  const userName = useAuthStore((s) => (loggedIn ? (s.user?.name ?? null) : null));
  const [query, setQuery] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const userLocation = useUserLocationStore((state) => state.position);
  const searchHistory = useSavedPlacesStore((state) => state.searchHistory);
  const savedPlaces = useSavedPlacesStore((state) => state.savedPlaces);
  const { height } = useWindowDimensions();
  // 唯讀：`sheetBottomInset` 把 detent index clamp 到 ≤ 1，所以只有 peek 會等於 index 0 的值
  const sheetInset = useMapUiStore((state) => state.sheetInset);
  const nearbyModel = useNearbyViewModel();
  const addSearchHistory = useSavedPlacesStore((state) => state.addSearchHistory);
  const setSelectedPlace = usePlaceUiStore((state) => state.setSelectedPlace);
  const { suggestions, loading, sessionToken, resetSession } = useAutocomplete(query, userLocation ?? undefined);

  const openPlace = (entry: PlaceDetail) => {
    addSearchHistory(entry);
    setSelectedPlace(entry);
    mapCamera.flyTo([entry.position.lng, entry.position.lat], 17);
    Keyboard.dismiss();
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

  // 與 `useSavedPlacesViewModel.handleNavigate` 同語意：選取 → 飛地圖 → push 詳情（不寫搜尋歷史）
  const handlePickSaved = (entry: PlaceDetail) => {
    setSelectedPlace(entry);
    mapCamera.flyTo([entry.position.lng, entry.position.lat], 17);
    Keyboard.dismiss();
    router.push(placeDetailHref(entry));
  };

  const openNearby = () => router.push('/nearby');
  const openSaved = () => router.push('/saved');

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

  const nearbyCards: ExploreNearbyCard[] =
    nearbyModel.status === 'ready'
      ? nearbyModel.rows.slice(0, NEARBY_CARD_LIMIT).map((row) => ({
          key: row.key,
          title: row.title,
          distanceText: row.distanceText,
          iconName: nearbyIconName(row.category),
          accessibilityLabel: row.accessibilityLabel,
          onPress: row.onPress,
        }))
      : [];

  const savedRows: ExploreRow[] = savedPlaces.slice(0, SAVED_ROW_LIMIT).map((entry) => ({
    key: placeKey(entry),
    title: placeDisplayName(entry),
    resolving: false,
    disabled: false,
    onPress: () => handlePickSaved(entry),
  }));

  return {
    query,
    onQueryChange: setQuery,
    loading,
    mode: query.trim() === '' ? 'history' : 'results',
    historyRows,
    resultRows,
    onOpenNearby: openNearby,
    onOpenSaved: openSaved,
    showBrand: sheetInset > sheetBottomInset(0, height),
    nearby: { title: t('nearbyContextTitle'), cards: nearbyCards },
    quickActions: [
      // 路線規劃與公車（Phase 2）：只經 sheet 路由切換面板，place 不 import 那兩個 feature。
      { key: 'plan', label: t('planRoute'), iconName: 'navigation', onPress: () => router.push('/plan') },
      { key: 'bus', label: t('busInfo'), iconName: 'bus', onPress: () => router.push('/bus') },
      { key: 'nearby', label: t('nearbyA11y'), iconName: 'accessibility', onPress: openNearby },
      { key: 'saved', label: t('savedPlaces'), iconName: 'bookmark', onPress: openSaved },
      // 危險通報（Phase 3）：root modal，未登入也能送
      { key: 'hazard', label: t('reportHazard'), iconName: 'alert', onPress: () => router.push('/hazard-report') },
    ],
    account: {
      label: userName ? `${t('settingTitle')}，${userName}` : t('settingTitle'),
      initial: userName ? userName.trim().slice(0, 1).toUpperCase() : null,
      onPress: () => router.push('/settings'),
    },
    savedRows,
    savedViewAll: savedPlaces.length > SAVED_VIEW_ALL_THRESHOLD ? { label: t('viewAll'), onPress: openSaved } : null,
    labels: {
      searchPlaceholder: t('searchPlaceHolder'),
      nearbyA11y: t('nearbyA11y'),
      savedPlaces: t('savedPlaces'),
      searchHistory: t('searchHistory'),
      searchResults: t('searchResults'),
      noResults: t('nativeNoSearchResults'),
      appTitle: t('title'),
      recentSearches: t('recentSearches'),
      quickActions: t('quickActions'),
      savedPlacesTitle: t('savedPlaces'),
    },
  };
}
