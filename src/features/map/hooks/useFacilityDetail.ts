import { haversineMeters } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';

import { mapCamera } from '../controller/mapCamera';
import type { Facility } from '../domain/facilities';
import { formatDistance } from '../domain/parking';
import { useFacilityStore } from '../store/facilityStore';
import { useUserLocationStore } from '../store/userLocationStore';

export interface FacilityDetailRow {
  label: string;
  value: string;
}

export type FacilityDetailModel =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'ready'; title: string; rows: FacilityDetailRow[]; onShowOnMap: () => void };

function wheelchairKey(value: Facility['wheelchair']): string | null {
  if (value === 'yes') return 'wheelchairYes';
  if (value === 'limited') return 'wheelchairLimited';
  if (value === 'no') return 'wheelchairNo';
  return null;
}

export function useFacilityDetail(id: string): FacilityDetailModel {
  const { t } = useAppTranslation();
  const facilities = useFacilityStore((state) => state.facilities);
  const position = useUserLocationStore((state) => state.position);
  if (!facilities) return { status: 'loading' };
  const facility = facilities.find((item) => item.id === id);
  if (!facility) return { status: 'not-found' };

  const rows: FacilityDetailRow[] = [{ label: t('nativeFacilityCategory'), value: t(facility.category) }];
  if (facility.exitName) rows.push({ label: t('exitInfo'), value: facility.exitName });
  if (facility.schoolName) rows.push({ label: t('a11yDefaultTitle'), value: facility.schoolName });
  const wheelchair = wheelchairKey(facility.wheelchair);
  if (wheelchair) rows.push({ label: t('wheelchairAccess'), value: t(wheelchair) });
  if (position) {
    const distance = haversineMeters(position, { lat: facility.lat, lng: facility.lng });
    rows.push({ label: t('nativeDistance'), value: formatDistance(distance) });
  }
  return {
    status: 'ready',
    title: facility.name,
    rows,
    onShowOnMap: () => mapCamera.flyTo([facility.lng, facility.lat], 18),
  };
}
