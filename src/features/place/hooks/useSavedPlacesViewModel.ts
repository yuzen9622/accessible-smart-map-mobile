import { router } from 'expo-router';
import { useState } from 'react';

import { mapCamera } from '@/features/map';
import { useAppTranslation } from '@/shared/i18n';

import { placeKey, SAVED_PLACE_CATEGORIES, type SavedPlaceCategory } from '../domain/placeKey';
import { placeDisplayName } from '../domain/searchHistory';
import { usePlaceUiStore } from '../store/placeUiStore';
import { useSavedPlacesStore } from '../store/savedPlacesStore';
import type { PlaceDetail } from '../types/place';
import { placeDetailHref } from './placeRoute';

export interface SavedPlaceRow {
  key: string;
  title: string;
  categoryLabel: string | null;
  onPress: () => void;
  onRemove: () => void;
  removeAccessibilityLabel: string;
}

export interface SavedPlacesFilterOption {
  value: SavedPlaceCategory | 'all';
  label: string;
  isSelected: boolean;
  onSelect: () => void;
}

export type SavedPlacesStatus = 'empty' | 'ready';

export interface SavedPlacesViewModel {
  status: SavedPlacesStatus;
  countLabel: string;
  filters: SavedPlacesFilterOption[];
  rows: SavedPlaceRow[];
  unsaveLabel: string;
  emptyTitle: string;
  emptyDescription: string;
}

/**
 * 收藏地點面板（`(sheet)/saved`）的 view-model。對齊 Web
 * `SavedPlacesPanel.tsx`（commit 5eadc71）：分類篩選（只顯示實際用到的分類）、
 * 清單、每列可「在地圖上查看」／「移除收藏」。
 */
export function useSavedPlacesViewModel(): SavedPlacesViewModel {
  const { t } = useAppTranslation();
  const savedPlaces = useSavedPlacesStore((state) => state.savedPlaces);
  const savedPlaceCategories = useSavedPlacesStore((state) => state.savedPlaceCategories);
  const removeSavedPlace = useSavedPlacesStore((state) => state.removeSavedPlace);
  const setSelectedPlace = usePlaceUiStore((state) => state.setSelectedPlace);
  const [filter, setFilter] = useState<SavedPlaceCategory | 'all'>('all');

  const unsaveLabel = t('unsavePlace');
  const emptyTitle = t('noSavedPlaces');
  const emptyDescription = t('noSavedPlacesHint');

  const usedCategories = SAVED_PLACE_CATEGORIES.filter((cat) =>
    savedPlaces.some((p) => savedPlaceCategories[placeKey(p)] === cat),
  );

  const filteredPlaces =
    filter === 'all' ? savedPlaces : savedPlaces.filter((p) => savedPlaceCategories[placeKey(p)] === filter);

  const handleNavigate = (item: PlaceDetail) => {
    setSelectedPlace(item);
    mapCamera.flyTo([item.position.lng, item.position.lat], 17);
    router.push(placeDetailHref(item));
  };

  if (savedPlaces.length === 0) {
    return { status: 'empty', countLabel: '', filters: [], rows: [], unsaveLabel, emptyTitle, emptyDescription };
  }

  const filters: SavedPlacesFilterOption[] =
    usedCategories.length > 0
      ? (['all', ...usedCategories] as const).map((cat) => ({
          value: cat,
          label: cat === 'all' ? t('savedCategoryAll') : t(`savedCategory.${cat}`),
          isSelected: filter === cat,
          onSelect: () => setFilter(cat),
        }))
      : [];

  const rows: SavedPlaceRow[] = filteredPlaces.map((item) => {
    const category = savedPlaceCategories[placeKey(item)] as SavedPlaceCategory | undefined;
    const title = placeDisplayName(item);
    return {
      key: placeKey(item),
      title,
      categoryLabel: category ? t(`savedCategory.${category}`) : null,
      onPress: () => handleNavigate(item),
      onRemove: () => removeSavedPlace(item),
      removeAccessibilityLabel: `${title}，${unsaveLabel}`,
    };
  });

  return {
    status: 'ready',
    countLabel: t('savedPlacesCount', { count: savedPlaces.length }),
    filters,
    rows,
    unsaveLabel,
    emptyTitle,
    emptyDescription,
  };
}
