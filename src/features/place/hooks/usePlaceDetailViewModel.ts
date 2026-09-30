import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Share } from 'react-native';

import { selectIsLoggedIn, useAuthStore } from '@/features/auth';
import { mapCamera } from '@/features/map';
// formatDistance 經 namespace 取用，讓上一行既有 import 保持原樣（namespace 不觸發 import/no-duplicates）
import * as mapFeature from '@/features/map';
import { getAppConfig } from '@/shared/config';
import { haversineMeters } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';

import { buildAccessibilityChecklist, type ChecklistItem } from '../domain/accessibilityChecklist';
import { nearbyFacilityRows, type NearbyFacilityRow } from '../domain/nearbyFacilityRows';
import { buildPlaceBadges, type PlaceBadge } from '../domain/placeBadges';
import { placeKey, SAVED_PLACE_CATEGORIES, type SavedPlaceCategory } from '../domain/placeKey';
import { evidenceLines } from '../domain/reviewEvidence';
import { buildPlaceShareUrl } from '../domain/shareUrl';
import { deleteReview } from '../api/reviews';
import { bumpReviewRevision, useReviewEditorStore } from '../store/reviewEditorStore';
import { isSavedPlace, useSavedPlacesStore } from '../store/savedPlacesStore';
import type { PlaceDetail } from '../types/place';
import { useReviews } from './useReviews';

const CHECKLIST_LABEL_KEY: Record<ChecklistItem['key'], string> = {
  wheelchair: 'wheelchairAccess',
  elevator: 'hasElevator',
  ramp: 'hasRamp',
  toilet: 'hasAccessibleToilet',
};

export interface PlaceDetailRow {
  label: string;
  value: string;
}

export interface PlaceDetailChecklistRow {
  key: string;
  label: string;
  statusLabel: string;
  /** 未確認項目的回報出口（「我知道 ›」→ 撰寫評價）；沒有評論 key 的地點為 undefined */
  onReport?: () => void;
  /** `available === false` 目前只有 `wheelchair` 這一項會出現（見 `domain/accessibilityChecklist.ts` 的不變量：
   * elevator／ramp／toilet 只能是 `true`／`null`，永遠不能是確定的 `false`）。 */
  tone: 'yes' | 'no' | 'unknown';
}

export interface PlaceDetailCategoryOption {
  value: SavedPlaceCategory;
  label: string;
  isSelected: boolean;
  onSelect: () => void;
}

export interface PlaceDetailLinkRow {
  label: string;
  onPress: () => void;
}

export type PlaceDetailBadge = PlaceBadge;

export type PlaceDetailNearbyRow = NearbyFacilityRow;

export interface PlaceDetailReviewRow {
  key: string;
  starsLabel: string;
  comment?: string;
  /** 綜合分數與已評估的無障礙細節；未評估的項目不列出。 */
  evidence: string[];
  /** 「您的評價」／「使用者」＋日期 */
  metaLabel: string;
  /** 自己的評論才有 */
  onEdit?: () => void;
  onDelete?: () => void;
}

export interface PlaceDetailReviewsModel {
  titleLabel: string;
  aiSummaryLabel: string | null;
  aiSummary: string | null;
  loading: boolean;
  items: PlaceDetailReviewRow[];
  hasMore: boolean;
  onLoadMore: () => void;
  loadMoreLabel: string;
  emptyLabel: string;
  /** 已登入：撰寫／編輯您的評價；未登入：提示登入 */
  write: { hint: string | null; label: string; onPress: () => void };
  editLabel: string;
  deleteLabel: string;
}

export interface PlaceDetailModel {
  title: string;
  subtitle: string | null;
  saved: boolean;
  saveLabel: string;
  planRouteLabel: string;
  shareLabel: string;
  /** iOS ShareLink 直接分享這個網址 */
  shareUrl: string;
  copyLabel: string;
  copied: boolean;
  onPlanRoute: () => void;
  onToggleSave: () => void;
  onShare: () => void;
  onCopy: () => void;
  categories: PlaceDetailCategoryOption[] | null;
  addressTitle: string;
  addressRows: PlaceDetailRow[];
  checklistTitle: string;
  checklist: PlaceDetailChecklistRow[];
  /** 「3 / 4 已確認」；清單為空時為 null */
  checklistConfirmedLabel: string | null;
  reportLabel: string;
  /** 「⋯」選單（回到此地點、複製連結） */
  moreLabel: string;
  cancelLabel: string;
  links: PlaceDetailLinkRow[];
  reviews: PlaceDetailReviewsModel | null;
  /** 次要動作：把相機帶回該地點 */
  recenterLabel: string;
  onRecenter: () => void;
  infoLabel: string;
  /** coordinate 地點為 [] */
  badges: PlaceDetailBadge[];
  nearbyTitle: string;
  nearbyEmptyLabel: string;
  /** coordinate 地點為 [] */
  nearbyRows: PlaceDetailNearbyRow[];
}

/**
 * 地點詳情面板（`(sheet)/place/[id]` 與 `(sheet)/loc/[coords]` 共用）的
 * view-model。對齊 Web `PlaceContent.tsx`（commit 5eadc71）的動作列與區塊
 * 順序，讀取路徑為主；「開放時間」在目前後端 `PlaceResult` 契約沒有對應
 * 欄位，本版略過該區塊（見 port-ledger 差異說明）。
 */
export function usePlaceDetailViewModel(entry: PlaceDetail): PlaceDetailModel {
  const { t, i18n } = useAppTranslation();
  const loggedIn = useAuthStore(selectIsLoggedIn);
  const userId = useAuthStore((s) => s.user?._id ?? null);
  const [copied, setCopied] = useState(false);
  const savedPlaces = useSavedPlacesStore((state) => state.savedPlaces);
  const savedPlaceCategories = useSavedPlacesStore((state) => state.savedPlaceCategories);
  const addSavedPlace = useSavedPlacesStore((state) => state.addSavedPlace);
  const removeSavedPlace = useSavedPlacesStore((state) => state.removeSavedPlace);
  const setSavedPlaceCategory = useSavedPlacesStore((state) => state.setSavedPlaceCategory);

  const saved = isSavedPlace(savedPlaces, entry);
  const key = placeKey(entry);
  const category = savedPlaceCategories[key] as SavedPlaceCategory | undefined;

  const place = entry.kind === 'place' ? entry.place : null;
  const title = entry.kind === 'place' ? entry.place.name || entry.place.fullAddress || '' : entry.address;
  const address = entry.kind === 'place' ? entry.place.fullAddress : entry.address;
  const userPosition = mapFeature.useUserLocationStore((state) => state.position);
  // 設計 1a：「類別 · 距離 · 地址」一行交代這是什麼、多遠
  const distanceText = userPosition ? mapFeature.formatDistance(haversineMeters(userPosition, entry.position)) : null;
  // Nominatim 的 fullAddress 常以地點名稱開頭（「安侯建業…, 7, 信義路五段…」），副標題不重複名稱
  const addressWithoutTitle = address && title && address.startsWith(title) ? address.slice(title.length).replace(/^[\s,，、]+/, '') : address;
  const subtitle =
    [place?.typeLabel ?? null, distanceText, addressWithoutTitle && addressWithoutTitle !== title ? addressWithoutTitle : null]
      .filter((part): part is string => Boolean(part))
      .join(' · ') || null;

  const checklistItems = place ? buildAccessibilityChecklist(place) : [];
  const reviews = useReviews(place?.reviewKey?.placeId ?? '', place?.reviewKey?.placeType ?? 'osm');
  const hasReviewKey = Boolean(place?.reviewKey);
  const shareUrl = buildPlaceShareUrl(getAppConfig().shareBaseUrl, entry);
  const { lat, lng } = entry.position;

  // 打開地點面板（搜尋、深層連結、點地圖）時相機帶到該地點；padding 已含 sheet 高度
  useEffect(() => {
    mapCamera.flyTo([lng, lat], 17);
  }, [lat, lng]);

  const handleToggleSave = () => {
    if (saved) removeSavedPlace(entry);
    else addSavedPlace(entry);
  };

  // Android／fallback 用；iOS 改用 @expo/ui ShareLink（RN Share 從 root VC 彈出，被常駐 formSheet 擋住不會顯示）
  const handleShare = () => {
    const run = async () => {
      try {
        await Share.share({ message: shareUrl, url: shareUrl });
      } catch {
        // 使用者取消分享，忽略
      }
    };
    void run();
  };

  const handleCopy = () => {
    const run = async () => {
      try {
        await Clipboard.setStringAsync(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch (error) {
        console.warn('[place] copy failed', error);
      }
    };
    void run();
  };

  // 對齊 Web `PlaceContent.tsx` 的「規劃路線」：把這個地點設為目的地並打開規劃面板。
  // 只經路由參數傳遞，place 不 import route feature（sheet 路由是兩者之間唯一的介面）。
  const handlePlanRoute = () => {
    router.navigate({ pathname: '/plan', params: { destLat: String(lat), destLng: String(lng), destName: title } });
  };

  const handleRecenter = () => {
    mapCamera.flyTo([entry.position.lng, entry.position.lat], 17);
  };

  const categories: PlaceDetailCategoryOption[] | null = saved
    ? SAVED_PLACE_CATEGORIES.map((cat) => ({
        value: cat,
        label: t(`savedCategory.${cat}`),
        isSelected: category === cat,
        onSelect: () => setSavedPlaceCategory(entry, category === cat ? null : cat),
      }))
    : null;

  const addressRows: PlaceDetailRow[] = place?.addressComponents
    ? (
        [
          place.addressComponents.road ? { label: t('road'), value: place.addressComponents.road } : null,
          place.addressComponents.district ? { label: t('district'), value: place.addressComponents.district } : null,
          place.addressComponents.city ? { label: t('city'), value: place.addressComponents.city } : null,
          place.addressComponents.postcode ? { label: t('postcode'), value: place.addressComponents.postcode } : null,
        ] as const
      ).filter((row): row is PlaceDetailRow => row !== null)
    : [];


  const links: PlaceDetailLinkRow[] = [];
  if (place?.externalLinks.osm) {
    const osmUrl = place.externalLinks.osm;
    links.push({ label: t('viewOnOSM'), onPress: () => void Linking.openURL(osmUrl) });
  }
  if (place?.externalLinks.google) {
    const googleUrl = place.externalLinks.google;
    links.push({ label: t('viewOnGoogleMaps'), onPress: () => void Linking.openURL(googleUrl) });
  }

  const reviewKey = place?.reviewKey ?? null;
  const ownReview = userId ? (reviews.reviews.find((r) => r.userId === userId) ?? null) : null;
  const openReviewForm = (review: typeof ownReview) => {
    if (!reviewKey) return;
    useReviewEditorStore.setState({ target: { placeId: reviewKey.placeId, placeType: reviewKey.placeType, placeName: title, review } });
    router.navigate('/review');
  };
  const confirmDeleteReview = (id: string) => {
    Alert.alert(t('reviewDelete'), t('reviewDeleteConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('reviewDelete'),
        style: 'destructive',
        onPress: () => {
          const run = async () => {
            try {
              await deleteReview(id);
              bumpReviewRevision();
            } catch (error) {
              Alert.alert(error instanceof Error && error.message ? error.message : t('reviewSubmitError'));
            }
          };
          void run();
        },
      },
    ]);
  };

  const reviewsModel: PlaceDetailReviewsModel | null =
    hasReviewKey && place?.reviewKey
      ? {
          titleLabel: reviews.totalCount > 0 ? `${t('reviewTitle')} (${reviews.totalCount})` : t('reviewTitle'),
          aiSummaryLabel: reviews.summary?.summary ? t('reviewAiSummary') : null,
          aiSummary: reviews.summary?.summary ?? null,
          loading: reviews.loading,
          items: reviews.reviews.map((review) => {
            const own = review.userId === userId;
            return {
              key: review._id,
              starsLabel: `${'★'.repeat(Math.round(review.rating))} ${review.rating.toFixed(1)}`,
              comment: review.comment,
              evidence: [
                ...(review.aggregateAccessibilityScore !== undefined
                  ? [`${t('nativeReviewAggregate')}：${review.aggregateAccessibilityScore.toFixed(1)}/5`]
                  : []),
                ...evidenceLines(review, t),
              ],
              metaLabel: `${own ? t('reviewYou') : t('reviewUser')} · ${new Date(review.createdAt).toLocaleDateString(i18n.language)}`,
              ...(own ? { onEdit: () => openReviewForm(review), onDelete: () => confirmDeleteReview(review._id) } : {}),
            };
          }),
          hasMore: reviews.hasMore,
          onLoadMore: reviews.loadMore,
          loadMoreLabel: t('reviewLoadMore'),
          emptyLabel: t('noReviews'),
          write: loggedIn
            ? { hint: null, label: ownReview ? t('reviewEditYours') : t('writeReview'), onPress: () => openReviewForm(ownReview) }
            : { hint: t('reviewLoginRequired'), label: t('loginRegisterCta'), onPress: () => router.navigate('/auth') },
          editLabel: t('edit'),
          deleteLabel: t('reviewDelete'),
        }
      : null;

  const checklist: PlaceDetailChecklistRow[] = checklistItems.map((item) => {
    const tone: PlaceDetailChecklistRow['tone'] = item.available === true ? 'yes' : item.available === false ? 'no' : 'unknown';
    const statusLabel = tone === 'yes' ? t('a11yStatusYes') : tone === 'no' ? t('a11yStatusNo') : t('a11yStatusUnknown');
    return {
      key: item.key,
      label: t(CHECKLIST_LABEL_KEY[item.key]),
      statusLabel,
      tone,
      onReport: tone === 'unknown' ? reviewsModel?.write.onPress : undefined,
    };
  });
  const confirmedCount = checklist.filter((row) => row.tone !== 'unknown').length;

  return {
    title,
    subtitle,
    saved,
    saveLabel: saved ? t('unsavePlace') : t('savePlace'),
    planRouteLabel: t('planRoute'),
    shareLabel: t('nativeShare'),
    shareUrl,
    copyLabel: copied ? t('nativeCopied') : t('copyLink'),
    copied,
    onPlanRoute: handlePlanRoute,
    onToggleSave: handleToggleSave,
    onShare: handleShare,
    onCopy: handleCopy,
    categories,
    addressTitle: t('addressInfo'),
    addressRows,
    checklistTitle: t('nativePlaceA11yInfo'),
    checklist,
    checklistConfirmedLabel:
      checklist.length > 0 ? t('nativePlaceA11yConfirmed', { confirmed: confirmedCount, total: checklist.length }) : null,
    reportLabel: t('nativePlaceIKnow'),
    moreLabel: t('nativePlaceMoreActions'),
    cancelLabel: t('cancel'),
    links,
    reviews: reviewsModel,
    recenterLabel: t('recenter'),
    onRecenter: handleRecenter,
    infoLabel: t('placeInfoLabel'),
    badges: buildPlaceBadges(place, t),
    nearbyTitle: t('nearbyA11y'),
    nearbyEmptyLabel: t('noNearbyA11y'),
    nearbyRows: nearbyFacilityRows(place, mapFeature.formatDistance),
  };
}
