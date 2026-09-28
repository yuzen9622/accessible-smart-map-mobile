import { router } from 'expo-router';

import { useAppTranslation } from '@/shared/i18n';

import { mapCamera } from '../controller/mapCamera';
import { PINNED_FACILITY_CATEGORIES, type PinnedFacilityCategory } from '../domain/facilities';
import { buildNearbyItems } from '../domain/nearby';
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

export interface CategoryToggle {
  category: PinnedFacilityCategory;
  label: string;
  isOn: boolean;
  onToggle: () => void;
}

export type NearbyStatus = 'loading' | 'no-location' | 'empty' | 'ready' | 'error';

export interface NearbyViewModel {
  status: NearbyStatus;
  toggles: CategoryToggle[];
  rows: NearbyRow[];
  errorMessage: string | null;
}

export function useNearbyViewModel(): NearbyViewModel {
  const { t } = useAppTranslation();
  const facilities = useFacilityStore((state) => state.facilities);
  const loadError = useFacilityStore((state) => state.loadError);
  const selected = useFacilityStore((state) => state.selected);
  const toggleCategory = useFacilityStore((state) => state.toggleCategory);
  const parking = useParkingStore((state) => state.items);
  const position = useUserLocationStore((state) => state.position);

  const toggles = PINNED_FACILITY_CATEGORIES.map((category) => ({
    category,
    label: t(category),
    isOn: selected.includes(category),
    onToggle: () => toggleCategory(category),
  }));

  if (loadError && !facilities) return { status: 'error', toggles, rows: [], errorMessage: loadError };
  if (!facilities) return { status: 'loading', toggles, rows: [], errorMessage: null };
  if (!position) return { status: 'no-location', toggles, rows: [], errorMessage: null };

  const items = buildNearbyItems(position, facilities, parking ?? [], new Set(selected));
  const rows = items.map((item): NearbyRow => {
    const distanceText = formatDistance(item.distance);
    if (item.kind === 'facility') {
      const subtitle = [t(item.facility.category), item.facility.exitName].filter(Boolean).join(' · ');
      return {
        key: `f-${item.id}`,
        title: item.facility.name,
        subtitle,
        distanceText,
        category: item.facility.category,
        accessibilityLabel: `${item.facility.name}，${subtitle}，${distanceText}`,
        onPress: () => router.push({ pathname: '/facility/[id]', params: { id: item.id } }),
      };
    }
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
  return { status: rows.length > 0 ? 'ready' : 'empty', toggles, rows, errorMessage: null };
}
