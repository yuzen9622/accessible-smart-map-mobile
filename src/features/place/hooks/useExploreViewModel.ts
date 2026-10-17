import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Keyboard, Linking, useWindowDimensions } from 'react-native';

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
import { logger } from '@/shared/logger';
import { useDictation, type DictationStatus } from '@/shared/speech';
import type { IconName } from '@/shared/ui';

import { getPlaceDetails } from '../api/placeSearch';
import { customCategoryColor } from '../domain/categoryColor';
import { toApiLang } from '../domain/lang';
import {
  SAVED_PLACE_CATEGORIES,
  isBuiltInSavedPlaceCategory,
  placeKey,
  savedCategoryLabel,
  type BuiltInSavedPlaceCategory,
  type SavedPlaceCategory,
} from '../domain/placeKey';
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
  /** 只有最近搜尋列才有：直接在這一列刪除這筆紀錄。 */
  onDelete?: () => void;
  deleteA11yLabel?: string;
}

/**
 * `idle`：預設首頁（快速服務／附近摘要／常去地點）。`history`：搜尋框取得焦點但還沒打字，
 * 顯示最近搜尋（可逐筆刪除）。`results`：已輸入關鍵字，顯示自動完成結果。
 */
export type ExploreMode = 'idle' | 'history' | 'results';

/** 「去哪裡」下方的常去地點圓鈕（收藏前幾筆） */
export interface ExploreShortcut {
  key: string;
  title: string;
  /** 與使用者的直線距離；沒有定位時為 null */
  meta: string | null;
  iconName: IconName;
  /** 圖示底色：依收藏分類區分（同上，使用者回饋 2026-10-11）。 */
  color: string;
  onPress: () => void;
}

/** 一句話附近摘要：「步行 5 分鐘內：3 部電梯、2 間無障礙廁所」 */
export interface ExploreNearbySummary {
  text: string;
  /** 摘要左側疊在一起的類別色圓點（最多兩個） */
  dots: { key: string; iconName: IconName; color: string }[];
  onPress: () => void;
}

const SAVED_CATEGORY_ICON: Record<BuiltInSavedPlaceCategory, IconName> = {
  favorite: 'heart',
  food: 'utensils',
  transport: 'tramFront',
  medical: 'hospital',
  other: 'mapPin',
};

/** 每個收藏分類各自一色（圓鈕底色＋圖示色）；跟 `QUICK_ACTION_COLOR`、地圖 `FACILITY_COLORS`
 * 一樣是固定色票、不隨主題切換——圖示在色塊上要一眼辨識類別，深／淺色模式下都得是同一個顏色。
 * 自訂分類沒有預先指定的顏色，見 `customCategoryColor`（依名字算一個固定色）。 */
const SAVED_CATEGORY_COLOR: Record<BuiltInSavedPlaceCategory, string> = {
  favorite: '#D6336C',
  food: '#E8590C',
  transport: '#0C8599',
  medical: '#E03131',
  other: '#495057',
};

export interface ExploreViewModel {
  query: string;
  onQueryChange: (text: string) => void;
  /** 點進搜尋框：sheet 展開到全高（Apple 地圖），鍵盤才不會蓋住結果；且在還沒打字時切到 `history` 模式。 */
  onSearchFocus: () => void;
  /**
   * TextInput 失焦時呼叫。**不會**切回 `idle` 首頁——`ScrollView` 的 `keyboardDismissMode="on-drag"`
   * 一開始下滑手勢就會讓輸入框失焦（RN 行為，不是滑到底才觸發），若在這裡把 `mode` 切回 `idle`／收合
   * sheet，使用者一開始下滑想捲動「最近搜尋」清單，畫面就會直接彈回首頁（使用者回饋 2026-10-17）。
   * 離開搜尋改交給明確的「取消」鍵（`onCancelSearch`）或選到一筆結果／最近搜尋。
   */
  onSearchBlur: () => void;
  /** 「最近搜尋」／「搜尋結果」畫面的明確返回鍵：清空查詢、收鍵盤、sheet 收回首頁高度。 */
  onCancelSearch: () => void;
  /** 自動完成請求 in-flight。 */
  loading: boolean;
  /** 自動完成請求或解析所選地點失敗（與「沒有結果」區分）。 */
  error: boolean;
  /** 重新送出目前查詢。 */
  onRetry: () => void;
  mode: ExploreMode;
  historyRows: ExploreRow[];
  /** 搜尋框取得焦點、還沒打字時，「最近搜尋」下面接的分類捷徑（像 Google 地圖）：
   * 「在附近找」是無障礙設施，直接開附近清單並帶篩選；「更多搜尋類別」是一般 POI 類別，
   * 把類別名稱當查詢字串送進既有的自動完成搜尋（跟使用者自己打字搜尋同一條路徑，
   * 不需要新的後端 API）。 */
  categoryShortcuts: {
    sectionTitle: string;
    nearbyFacilities: { key: string; label: string; iconName: IconName; onPress: () => void }[];
    moreTitle: string;
    moreCategories: { key: string; label: string; iconName: IconName; onPress: () => void }[];
  };
  resultRows: ExploreRow[];
  onOpenNearby: () => void;
  onOpenSaved: () => void;
  /** sheet 展開（half/full）時才顯示品牌列；peek 只露搜尋框（SDD §4.5）。 */
  showBrand: boolean;
  /** 大標「去哪裡？」與右側的行動需求 pill（點了到設定的需求頁） */
  header: { title: string; needs: { label: string; accessibilityLabel: string; onPress: () => void } };
  /** 搜尋框下方常駐「規劃路線」入口：不需要先搜到地點，直接開路線面板選起訖點
   * （與網頁版左側常駐「規劃路線」對齊；地點詳情頁的「規劃路線」按鈕是另一條帶目的地的捷徑，兩者並存）。 */
  planRoute: { label: string; accessibilityLabel: string; onPress: () => void };
  /** 收藏地點（依下方 shortcutFilters 勾選的分類篩選，全部收藏可橫向滑動瀏覽）；
   * 旁邊的「新增」是常去地點區塊標題右側的小按鈕，不再混在圓鈕那排裡 */
  shortcuts: ExploreShortcut[];
  /** 常去地點分類複選 chip；只列出「實際有被用到」的分類。一個都沒勾＝顯示全部。 */
  shortcutFilters: { key: SavedPlaceCategory; label: string; selected: boolean; onToggle: () => void }[];
  addShortcut: { label: string; accessibilityLabel: string; onPress: () => void };
  /** 沒有定位或設施未載入時為 null */
  nearbySummary: ExploreNearbySummary | null;
  /** 搜尋框右側的帳號／設定按鈕（Apple 地圖的頭像位置）；已登入顯示名字首字 */
  account: { label: string; initial: string | null; onPress: () => void };
  /** 搜尋框的語音輸入：原地辨識、講完直接把文字填進搜尋框觸發搜尋，不開啟任何對話 UI
   * （測試人員回饋 2026-10-11：一開始接去 AI 聊天頁是誤解，使用者要的是像 Google 地圖那種
   * 「按麥克風→講話→文字自動出現在搜尋框」）。見 `@/shared/speech` 的 `useDictation`。 */
  voiceInput: { status: DictationStatus; label: string; accessibilityLabel: string; onToggle: () => void };
  labels: {
    searchPlaceholder: string;
    nearbyA11y: string;
    savedPlaces: string;
    searchHistory: string;
    searchResults: string;
    noResults: string;
    searching: string;
    cancelSearch: string;
    recentSearches: string;
    moreActions: string;
    networkError: string;
    retry: string;
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
  const [searchFocused, setSearchFocused] = useState(false);
  // 常去地點分類複選；空陣列＝不篩選、全部顯示（預設）。
  const [shortcutCategoryFilter, setShortcutCategoryFilter] = useState<SavedPlaceCategory[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveFailed, setResolveFailed] = useState(false);
  const userLocation = useUserLocationStore((state) => state.position);
  const searchHistory = useSavedPlacesStore((state) => state.searchHistory);
  const savedPlaces = useSavedPlacesStore((state) => state.savedPlaces);
  const { height } = useWindowDimensions();
  // 唯讀：`sheetBottomInset` 把 detent index clamp 到 ≤ 1，所以只有 peek 會等於 index 0 的值
  const sheetInset = useMapUiStore((state) => state.sheetInset);
  const nearbySummary = useNearbySummary();
  const savedPlaceCategories = useSavedPlacesStore((state) => state.savedPlaceCategories);
  const customCategories = useSavedPlacesStore((state) => state.customCategories);
  const routeMode = useOnboardingStore((state) => state.profile.routeMode);
  const addSearchHistory = useSavedPlacesStore((state) => state.addSearchHistory);
  const removeSearchHistory = useSavedPlacesStore((state) => state.removeSearchHistory);
  const setSelectedPlace = usePlaceUiStore((state) => state.setSelectedPlace);
  const { suggestions, loading, error: autocompleteError, retry, sessionToken, resetSession } = useAutocomplete(query, userLocation ?? undefined);
  const dictation = useDictation((transcript) => {
    setResolveFailed(false);
    setQuery(transcript);
    sheetController.raiseTo(SHEET_DETENTS.length - 1);
  });
  useEffect(() => {
    if (dictation.status !== 'denied') return;
    Alert.alert(t('nativeVoiceSearchDenied'), undefined, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('nativeOpenSettings'), onPress: () => void Linking.openSettings() },
    ]);
  }, [dictation.status, t]);

  const openPlace = (entry: PlaceDetail) => {
    addSearchHistory(entry);
    setSelectedPlace(entry);
    mapCamera.flyTo([entry.position.lng, entry.position.lat], 17);
    Keyboard.dismiss();
    setSearchFocused(false);
    router.navigate(placeDetailHref(entry));
  };

  const handlePickSuggestion = async (item: AutocompleteItem) => {
      if (resolvingId) return;
      setResolvingId(item.id);
      setResolveFailed(false);
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
        logger.warn('[place] resolve suggestion failed', error);
        setResolveFailed(true);
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
    router.navigate(placeDetailHref(entry));
  };

  const openNearby = () => router.navigate('/nearby');
  const openSaved = () => router.navigate('/saved');

  const historyRows: ExploreRow[] = searchHistory.map((entry, index) => ({
    key: `${placeDisplayName(entry)}-${index}`,
    title: placeDisplayName(entry),
    resolving: false,
    disabled: false,
    onPress: () => handlePickHistory(entry),
    onDelete: () => removeSearchHistory(entry),
    deleteA11yLabel: t('nativeHomeDeleteHistoryA11y', { name: placeDisplayName(entry) }),
  }));

  const openNearbyCategory = (category: 'elevator' | 'ramp' | 'toilet' | 'parking') => {
    Keyboard.dismiss();
    setSearchFocused(false);
    router.navigate({ pathname: '/nearby', params: { category } });
  };

  // 「更多搜尋類別」：類別名稱直接當查詢字串送進既有自動完成搜尋，跟使用者自己打字搜尋是同一條路徑。
  const searchByCategory = (label: string) => {
    setResolveFailed(false);
    setQuery(label);
    sheetController.raiseTo(SHEET_DETENTS.length - 1);
  };

  const categoryShortcuts: ExploreViewModel['categoryShortcuts'] = {
    sectionTitle: t('nativeSearchNearbyTitle'),
    nearbyFacilities: [
      { key: 'elevator', label: t('elevator'), iconName: 'elevator', onPress: () => openNearbyCategory('elevator') },
      { key: 'ramp', label: t('a11yFeatureRamp'), iconName: 'ramp', onPress: () => openNearbyCategory('ramp') },
      { key: 'toilet', label: t('toilet'), iconName: 'toilet', onPress: () => openNearbyCategory('toilet') },
      { key: 'parking', label: t('nativeSearchNearbyParking'), iconName: 'parking', onPress: () => openNearbyCategory('parking') },
    ],
    moreTitle: t('nativeSearchMoreCategoriesTitle'),
    moreCategories: [
      { key: 'restaurant', label: t('nativeSearchCategoryRestaurant'), iconName: 'utensils', onPress: () => searchByCategory(t('nativeSearchCategoryRestaurant')) },
      { key: 'supermarket', label: t('nativeSearchCategorySupermarket'), iconName: 'shoppingBasket', onPress: () => searchByCategory(t('nativeSearchCategorySupermarket')) },
      { key: 'cafe', label: t('nativeSearchCategoryCafe'), iconName: 'coffee', onPress: () => searchByCategory(t('nativeSearchCategoryCafe')) },
      { key: 'pharmacy', label: t('nativeSearchCategoryPharmacy'), iconName: 'pill', onPress: () => searchByCategory(t('nativeSearchCategoryPharmacy')) },
      { key: 'gasStation', label: t('nativeSearchCategoryGasStation'), iconName: 'fuel', onPress: () => searchByCategory(t('nativeSearchCategoryGasStation')) },
      { key: 'hotel', label: t('nativeSearchCategoryHotel'), iconName: 'bedDouble', onPress: () => searchByCategory(t('nativeSearchCategoryHotel')) },
      { key: 'attraction', label: t('nativeSearchCategoryAttraction'), iconName: 'camera', onPress: () => searchByCategory(t('nativeSearchCategoryAttraction')) },
      { key: 'more', label: t('nativeSearchMoreCategories'), iconName: 'ellipsis', onPress: openNearby },
    ],
  };

  const resultRows: ExploreRow[] = suggestions.map((item) => ({
    key: item.id,
    title: item.primaryText,
    subtitle: item.secondaryText ?? undefined,
    resolving: resolvingId === item.id,
    disabled: resolvingId !== null,
    onPress: () => void handlePickSuggestion(item),
  }));

  const resolvedCategoryOf = (entry: PlaceDetail): SavedPlaceCategory => {
    const category = savedPlaceCategories[placeKey(entry)];
    return category ?? 'other';
  };
  // 只列出「實際有被用到」的分類當 chip（與收藏地點清單頁同邏輯，見 useSavedPlacesViewModel）；
  // 內建分類固定順序在前，自訂分類依建立順序接在後面。
  const usedShortcutCategories = [...SAVED_PLACE_CATEGORIES, ...customCategories].filter((category) =>
    savedPlaces.some((entry) => resolvedCategoryOf(entry) === category),
  );
  const shortcutFilters = usedShortcutCategories.map((category) => ({
    key: category,
    label: savedCategoryLabel(t, category),
    selected: shortcutCategoryFilter.includes(category),
    onToggle: () =>
      setShortcutCategoryFilter((current) =>
        current.includes(category) ? current.filter((item) => item !== category) : [...current, category],
      ),
  }));
  const visibleSavedPlaces =
    shortcutCategoryFilter.length === 0
      ? savedPlaces
      : savedPlaces.filter((entry) => shortcutCategoryFilter.includes(resolvedCategoryOf(entry)));
  const shortcuts: ExploreShortcut[] = visibleSavedPlaces.map((entry) => {
    const key = placeKey(entry);
    const resolvedCategory = resolvedCategoryOf(entry);
    return {
      key,
      title: placeDisplayName(entry),
      meta: userLocation ? formatDistance(haversineMeters(userLocation, entry.position)) : null,
      iconName: isBuiltInSavedPlaceCategory(resolvedCategory) ? SAVED_CATEGORY_ICON[resolvedCategory] : 'bookmark',
      color: isBuiltInSavedPlaceCategory(resolvedCategory)
        ? SAVED_CATEGORY_COLOR[resolvedCategory]
        : customCategoryColor(resolvedCategory),
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
    onQueryChange: (text: string) => {
      setResolveFailed(false);
      setQuery(text);
    },
    onSearchFocus: () => {
      sheetController.raiseTo(SHEET_DETENTS.length - 1);
      setSearchFocused(true);
    },
    // 刻意不在這裡動 searchFocused／sheet（見上面介面的註解）：失焦不等於使用者要離開搜尋。
    onSearchBlur: () => {},
    // 「最近搜尋」／「搜尋結果」兩種全高畫面都沒有返回鍵，刪光文字才會退回首頁，使用者回報
    // 完全不知道怎麼離開（2026-10-15）。加一顆明確的取消鍵：清空查詢、收鍵盤、把 sheet 收回去。
    onCancelSearch: () => {
      Keyboard.dismiss();
      setQuery('');
      setResolveFailed(false);
      setSearchFocused(false);
      sheetController.collapse();
    },
    loading,
    error: autocompleteError || resolveFailed,
    onRetry: () => {
      setResolveFailed(false);
      retry();
    },
    mode: query.trim() !== '' ? 'results' : searchFocused ? 'history' : 'idle',
    historyRows,
    categoryShortcuts,
    resultRows,
    onOpenNearby: openNearby,
    onOpenSaved: openSaved,
    showBrand: sheetInset > sheetBottomInset(0, height),
    header: {
      title: t('nativeWhereTo'),
      needs: {
        label: routeModeLabel,
        accessibilityLabel: t('nativeHomeNeedsA11y', { mode: routeModeLabel }),
        onPress: () => router.navigate('/settings/needs'),
      },
    },
    planRoute: { label: t('planRoute'), accessibilityLabel: t('planRoute'), onPress: () => router.navigate('/plan') },
    shortcuts,
    shortcutFilters,
    addShortcut: { label: t('nativeHomeAddShortcut'), accessibilityLabel: t('nativeHomeAddShortcutA11y'), onPress: openSaved },
    nearbySummary: summary,
    account: {
      label: userName ? `${t('settingTitle')}，${userName}` : t('settingTitle'),
      initial: userName ? userName.trim().slice(0, 1).toUpperCase() : null,
      onPress: () => router.navigate('/settings'),
    },
    voiceInput: {
      status: dictation.status,
      label: t('chatbot.voice.micLabel'),
      accessibilityLabel:
        dictation.status === 'listening' ? t('nativeVoiceSearchListening') : t('chatbot.voice.micLabel'),
      onToggle: () => {
        if (dictation.status === 'listening') dictation.stop();
        else void dictation.start();
      },
    },
    labels: {
      searchPlaceholder: t('searchPlaceHolder'),
      nearbyA11y: t('nearbyA11y'),
      savedPlaces: t('savedPlaces'),
      searchHistory: t('searchHistory'),
      searchResults: t('searchResults'),
      noResults: t('nativeNoSearchResults'),
      searching: t('nativeSearching'),
      cancelSearch: t('cancel'),
      recentSearches: t('recentSearches'),
      moreActions: t('nativeHomeMoreActions'),
      networkError: t('nativeNetworkError'),
      retry: t('retry'),
    },
  };
}
