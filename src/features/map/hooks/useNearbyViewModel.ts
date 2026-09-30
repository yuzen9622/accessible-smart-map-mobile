import { router } from 'expo-router';
import { useState } from 'react';

import { useAppTranslation } from '@/shared/i18n';

import { mapCamera } from '../controller/mapCamera';
import { PINNED_FACILITY_CATEGORIES, type FacilitySource, type PinnedFacilityCategory } from '../domain/facilities';
import { NEARBY_RADIUS_M, buildFilteredNearbyItems, countNearby, type NearbyFilter } from '../domain/nearby';
import { formatDistance } from '../domain/parking';
import { useFacilityStore } from '../store/facilityStore';
import { useParkingStore } from '../store/parkingStore';
import { useUserLocationStore } from '../store/userLocationStore';

export interface NearbyRow {
  key: string;
  title: string;
  subtitle: string;
  distanceText: string;
  /** 設施類別；停車為 `'parking'`（供其他面板挑對應圖示） */
  category: PinnedFacilityCategory | 'parking';
  /** VoiceOver 一次念完：名稱、類別、距離 */
  accessibilityLabel: string;
  onPress: () => void;
}

export interface NearbyFilterOption {
  value: NearbyFilter;
  label: string;
  accessibilityLabel: string;
  selected: boolean;
}

export type NearbyStatus = 'loading' | 'no-location' | 'empty' | 'ready' | 'error';

export interface NearbyViewModel {
  status: NearbyStatus;
  filters: NearbyFilterOption[];
  onSelectFilter: (filter: NearbyFilter) => void;
  rows: NearbyRow[];
  /** 「依距離排序 · 2 km 內」 */
  sortNote: string;
  /** 目前列出的資料來源；沒有列出任何項目時為 null。 */
  sourcesNote: string | null;
  errorMessage: string | null;
}

const SOURCE_KEY: Record<FacilitySource, string> = {
  metro: 'nativeFacilitySourceMetro',
  osm: 'nativeFacilitySourceOsm',
  campus: 'nativeFacilitySourceCampus',
  bathroom: 'nativeFacilitySourceBathroom',
  parking: 'nativeFacilitySourceParking',
};

export function isNearbyFilter(value: unknown): value is NearbyFilter {
  return value === 'all' || value === 'parking' || PINNED_FACILITY_CATEGORIES.some((category) => category === value);
}

/** 附近設施清單（設計 2a）：分類 segmented 帶數量、依距離排序、底部標註資料來源。 */
export function useNearbyViewModel(initialFilter: NearbyFilter = 'all'): NearbyViewModel {
  const { t } = useAppTranslation();
  const [filter, setFilter] = useState<NearbyFilter>(initialFilter);
  const facilities = useFacilityStore((state) => state.facilities);
  const loadError = useFacilityStore((state) => state.loadError);
  const parking = useParkingStore((state) => state.items);
  const position = useUserLocationStore((state) => state.position);

  const counts = position && facilities ? countNearby(position, facilities, parking ?? []) : null;
  const filterValues: NearbyFilter[] = ['all', ...PINNED_FACILITY_CATEGORIES];
  // 停車只有附近真的有資料時才給一個分類，免得多一個永遠是 0 的選項。
  if ((counts?.parking ?? 0) > 0 || filter === 'parking') filterValues.push('parking');
  const filters = filterValues.map((value): NearbyFilterOption => {
    const label =
      value === 'all' ? t('nativeFacilityFilterAll') : value === 'parking' ? t('nativeFacilityFilterParking') : t(value);
    const count = value === 'all' || !counts ? null : counts[value];
    return {
      value,
      label: count === null ? label : t('nativeFacilityFilterCount', { label, count }),
      accessibilityLabel: count === null ? label : t('nativeFacilityFilterCountLabel', { label, count }),
      selected: value === filter,
    };
  });
  const base = {
    filters,
    onSelectFilter: setFilter,
    sortNote: t('nativeFacilitySortedByDistance', { radius: formatDistance(NEARBY_RADIUS_M) }),
  };

  if (loadError && !facilities) return { ...base, status: 'error', rows: [], sourcesNote: null, errorMessage: loadError };
  if (!facilities) return { ...base, status: 'loading', rows: [], sourcesNote: null, errorMessage: null };
  if (!position) return { ...base, status: 'no-location', rows: [], sourcesNote: null, errorMessage: null };

  const items = buildFilteredNearbyItems(position, facilities, parking ?? [], filter);
  const sources = new Set<FacilitySource>();
  const rows = items.map((item): NearbyRow => {
    const distanceText = formatDistance(item.distance);
    if (item.kind === 'facility') {
      sources.add(item.facility.source);
      const subtitle = [t(SOURCE_KEY[item.facility.source]), item.facility.exitName ?? item.facility.schoolName]
        .filter(Boolean)
        .join(' · ');
      return {
        key: `f-${item.id}`,
        title: item.facility.name,
        subtitle,
        distanceText,
        category: item.facility.category,
        accessibilityLabel: `${item.facility.name}，${t(item.facility.category)}，${subtitle}，${distanceText}`,
        onPress: () => router.navigate({ pathname: '/facility/[id]', params: { id: item.id } }),
      };
    }
    sources.add('parking');
    const title = item.parking.type === 'lot' ? item.parking.name : item.parking.placeName;
    const subtitle = t('parking');
    return {
      key: `p-${item.id}`,
      title,
      subtitle,
      distanceText,
      category: 'parking',
      accessibilityLabel: `${title}，${subtitle}，${distanceText}`,
      onPress: () => mapCamera.flyTo([item.position.lng, item.position.lat], 18),
    };
  });
  const sourcesNote =
    sources.size > 0
      ? t('nativeFacilitySources', { sources: [...sources].map((source) => t(SOURCE_KEY[source])).join(t('nativeHomeListSeparator')) })
      : null;
  return { ...base, status: rows.length > 0 ? 'ready' : 'empty', rows, sourcesNote, errorMessage: null };
}
