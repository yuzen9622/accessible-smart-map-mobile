import { router } from 'expo-router';
import { useState } from 'react';

import { mapCamera } from '@/features/map';
import { useAppTranslation } from '@/shared/i18n';

import { SAVED_PLACE_CATEGORIES, isBuiltInSavedPlaceCategory, placeKey, savedCategoryLabel, type SavedPlaceCategory } from '../domain/placeKey';
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
  /** 自訂分類（非內建）才能重新命名／刪除，像 Google 地圖可以編輯自己建的清單。 */
  isCustom: boolean;
  onSelect: () => void;
}

export type SavedPlacesStatus = 'empty' | 'ready';

export interface SavedPlacesCategoryManagement {
  /** 建立新分類；名稱重複或空字串會被忽略。 */
  onCreate: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (name: string) => void;
  addLabel: string;
  renameLabel: string;
  deleteLabel: string;
  newCategoryTitle: string;
  renameCategoryTitle: string;
}

export interface SavedPlacesViewModel {
  status: SavedPlacesStatus;
  countLabel: string;
  filters: SavedPlacesFilterOption[];
  rows: SavedPlaceRow[];
  unsaveLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  categoryManagement: SavedPlacesCategoryManagement;
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
  const customCategories = useSavedPlacesStore((state) => state.customCategories);
  const removeSavedPlace = useSavedPlacesStore((state) => state.removeSavedPlace);
  const addCustomCategory = useSavedPlacesStore((state) => state.addCustomCategory);
  const renameCustomCategory = useSavedPlacesStore((state) => state.renameCustomCategory);
  const removeCustomCategory = useSavedPlacesStore((state) => state.removeCustomCategory);
  const setSelectedPlace = usePlaceUiStore((state) => state.setSelectedPlace);
  const [filter, setFilter] = useState<SavedPlaceCategory | 'all'>('all');

  const unsaveLabel = t('unsavePlace');
  const emptyTitle = t('noSavedPlaces');
  const emptyDescription = t('noSavedPlacesHint');

  const categoryManagement: SavedPlacesCategoryManagement = {
    onCreate: (name) => addCustomCategory(name),
    onRename: (oldName, newName) => renameCustomCategory(oldName, newName),
    onDelete: (name) => {
      removeCustomCategory(name);
      setFilter((current) => (current === name ? 'all' : current));
    },
    addLabel: t('nativeSavedCategoryAdd'),
    renameLabel: t('nativeSavedCategoryRename'),
    deleteLabel: t('nativeSavedCategoryDelete'),
    newCategoryTitle: t('nativeSavedCategoryNewTitle'),
    renameCategoryTitle: t('nativeSavedCategoryRenameTitle'),
  };

  // 內建分類固定順序在前，自訂分類依建立順序接在後面；都只列「實際有被用到」的（跟首頁常去地點同邏輯）。
  const usedCategories = [...SAVED_PLACE_CATEGORIES, ...customCategories].filter((cat) =>
    savedPlaces.some((p) => savedPlaceCategories[placeKey(p)] === cat),
  );

  const filteredPlaces =
    filter === 'all' ? savedPlaces : savedPlaces.filter((p) => savedPlaceCategories[placeKey(p)] === filter);

  const handleNavigate = (item: PlaceDetail) => {
    setSelectedPlace(item);
    mapCamera.flyTo([item.position.lng, item.position.lat], 17);
    router.navigate(placeDetailHref(item));
  };

  if (savedPlaces.length === 0) {
    return {
      status: 'empty',
      countLabel: '',
      filters: [],
      rows: [],
      unsaveLabel,
      emptyTitle,
      emptyDescription,
      categoryManagement,
    };
  }

  const filters: SavedPlacesFilterOption[] =
    usedCategories.length > 0
      ? (['all', ...usedCategories] as const).map((cat) => ({
          value: cat,
          label: cat === 'all' ? t('savedCategoryAll') : savedCategoryLabel(t, cat),
          isSelected: filter === cat,
          isCustom: cat !== 'all' && !isBuiltInSavedPlaceCategory(cat),
          onSelect: () => setFilter(cat),
        }))
      : [];

  const rows: SavedPlaceRow[] = filteredPlaces.map((item) => {
    const category = savedPlaceCategories[placeKey(item)] as SavedPlaceCategory | undefined;
    const title = placeDisplayName(item);
    return {
      key: placeKey(item),
      title,
      categoryLabel: category ? savedCategoryLabel(t, category) : null,
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
    categoryManagement,
  };
}
