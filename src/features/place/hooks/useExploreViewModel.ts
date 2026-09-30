import { router } from 'expo-router';
import { useState } from 'react';
import { Keyboard, useWindowDimensions } from 'react-native';

import {
  FACILITY_COLORS,
  SHEET_DETENTS,
  mapCamera,
  sheetBottomInset,
  sheetController,
  useMapUiStore,
  useNearbySummary,
  useUserLocationStore,
} from '@/features/map';
import { selectIsLoggedIn, useAuthStore } from '@/features/auth';
import { ROUTE_MODE_LABEL_KEY, useOnboardingStore } from '@/features/onboarding';
import { formatDistance, haversineMeters } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';
import type { IconName } from '@/shared/ui';

import { getPlaceDetails } from '../api/placeSearch';
import { toApiLang } from '../domain/lang';
import { isSavedPlaceCategory, placeKey, type SavedPlaceCategory } from '../domain/placeKey';
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

export interface ExploreQuickAction {
  key: 'assistant' | 'plan' | 'bus' | 'hazard';
  label: string;
  iconName: 'sparkles' | 'navigation' | 'bus' | 'alert';
  onPress: () => void;
}

/** 「去哪裡」下方的常去地點圓鈕（收藏前幾筆） */
export interface ExploreShortcut {
  key: string;
  title: string;
  /** 與使用者的直線距離；沒有定位時為 null */
  meta: string | null;
  iconName: IconName;
  onPress: () => void;
}

/** 一句話附近摘要：「步行 5 分鐘內：3 部電梯、2 間無障礙廁所」 */
export interface ExploreNearbySummary {
  text: string;
  /** 摘要左側疊在一起的類別色圓點（最多兩個） */
  dots: { key: string; iconName: IconName; color: string }[];
  onPress: () => void;
}

const SHORTCUT_LIMIT = 3;

const SAVED_CATEGORY_ICON: Record<SavedPlaceCategory, IconName> = {
  favorite: 'heart',
  food: 'utensils',
  transport: 'tramFront',
  medical: 'hospital',
  other: 'mapPin',
};

export interface ExploreViewModel {
  query: string;
  onQueryChange: (text: string) => void;
  /** 點進搜尋框：sheet 展開到全高（Apple 地圖），鍵盤才不會蓋住結果。 */
  onSearchFocus: () => void;
  /** 自動完成請求 in-flight。 */
  loading: boolean;
  mode: ExploreMode;
  historyRows: ExploreRow[];
  resultRows: ExploreRow[];
  onOpenNearby: () => void;
  onOpenSaved: () => void;
  /** sheet 展開（half/full）時才顯示品牌列；peek 只露搜尋框（SDD §4.5）。 */
  showBrand: boolean;
  /** 大標「去哪裡？」與右側的行動需求 pill（點了到設定的需求頁） */
  header: { title: string; needs: { label: string; accessibilityLabel: string; onPress: () => void } };
  /** 收藏前 3 筆；最後固定一顆「新增」開收藏清單 */
  shortcuts: ExploreShortcut[];
  addShortcut: { label: string; onPress: () => void };
  /** 沒有定位或設施未載入時為 null */
  nearbySummary: ExploreNearbySummary | null;
  quickActions: ExploreQuickAction[];
  /** 搜尋框右側的帳號／設定按鈕（Apple 地圖的頭像位置）；已登入顯示名字首字 */
  account: { label: string; initial: string | null; onPress: () => void };
  labels: {
    searchPlaceholder: string;
    nearbyA11y: string;
    savedPlaces: string;
    searchHistory: string;
    searchResults: string;
    noResults: string;
    recentSearches: string;
    moreActions: string;
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
  const nearbySummary = useNearbySummary();
  const savedPlaceCategories = useSavedPlacesStore((state) => state.savedPlaceCategories);
  const routeMode = useOnboardingStore((state) => state.profile.routeMode);
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

  const shortcuts: ExploreShortcut[] = savedPlaces.slice(0, SHORTCUT_LIMIT).map((entry) => {
    const key = placeKey(entry);
    const category = savedPlaceCategories[key];
    return {
      key,
      title: placeDisplayName(entry),
      meta: userLocation ? formatDistance(haversineMeters(userLocation, entry.position)) : null,
      iconName: isSavedPlaceCategory(category) ? SAVED_CATEGORY_ICON[category] : 'bookmark',
      onPress: () => handlePickSaved(entry),
    };
  });

  const summaryParts = nearbySummary
    ? [
        { key: 'elevator', count: nearbySummary.elevator, label: 'nativeHomeNearbyElevators', icon: 'elevator' },
        { key: 'toilet', count: nearbySummary.toilet, label: 'nativeHomeNearbyToilets', icon: 'toilet' },
        { key: 'ramp', count: nearbySummary.ramp, label: 'nativeHomeNearbyRamps', icon: 'ramp' },
      ] as const
    : [];
  const presentParts = summaryParts.filter((part) => part.count > 0);
  const summary: ExploreNearbySummary | null = nearbySummary
    ? {
        text:
          presentParts.length > 0
            ? t('nativeHomeNearbySummary', { parts: presentParts.map((part) => t(part.label, { count: part.count })).join(t('nativeHomeListSeparator')) })
            : t('nativeHomeNearbyNone'),
        dots: presentParts.slice(0, 2).map((part) => ({ key: part.key, iconName: part.icon, color: FACILITY_COLORS[part.key] })),
        onPress: openNearby,
      }
    : null;
  const routeModeLabel = t(ROUTE_MODE_LABEL_KEY[routeMode]);

  return {
    query,
    onQueryChange: setQuery,
    onSearchFocus: () => sheetController.raiseTo(SHEET_DETENTS.length - 1),
    loading,
    mode: query.trim() === '' ? 'history' : 'results',
    historyRows,
    resultRows,
    onOpenNearby: openNearby,
    onOpenSaved: openSaved,
    showBrand: sheetInset > sheetBottomInset(0, height),
    header: {
      title: t('nativeWhereTo'),
      needs: {
        label: routeModeLabel,
        accessibilityLabel: t('nativeHomeNeedsA11y', { mode: routeModeLabel }),
        onPress: () => router.push('/settings/needs'),
      },
    },
    shortcuts,
    addShortcut: { label: t('nativeHomeAddShortcut'), onPress: openSaved },
    nearbySummary: summary,
    quickActions: [
      // 路線規劃與公車（Phase 2）：只經 sheet 路由切換面板，place 不 import 那兩個 feature。
      // AI 助理（Phase 4）：root modal；place 不 import ai feature
      { key: 'assistant', label: t('assistShort'), iconName: 'sparkles', onPress: () => router.push('/chat') },
      { key: 'plan', label: t('planRoute'), iconName: 'navigation', onPress: () => router.push('/plan') },
      { key: 'bus', label: t('busInfo'), iconName: 'bus', onPress: () => router.push('/bus') },
      // 危險通報（Phase 3）：root modal，未登入也能送
      { key: 'hazard', label: t('reportHazard'), iconName: 'alert', onPress: () => router.push('/hazard-report') },
    ],
    account: {
      label: userName ? `${t('settingTitle')}，${userName}` : t('settingTitle'),
      initial: userName ? userName.trim().slice(0, 1).toUpperCase() : null,
      onPress: () => router.push('/settings'),
    },
    labels: {
      searchPlaceholder: t('searchPlaceHolder'),
      nearbyA11y: t('nearbyA11y'),
      savedPlaces: t('savedPlaces'),
      searchHistory: t('searchHistory'),
      searchResults: t('searchResults'),
      noResults: t('nativeNoSearchResults'),
      recentSearches: t('recentSearches'),
      moreActions: t('nativeHomeMoreActions'),
    },
  };
}
