import { router } from 'expo-router';

import { haversineMeters } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';
import type { IconName } from '@/shared/ui';

import { mapCamera } from '../controller/mapCamera';
import type { Facility, FacilitySource } from '../domain/facilities';
import { formatDistance } from '../domain/parking';
import { useFacilityStore } from '../store/facilityStore';
import { useUserLocationStore } from '../store/userLocationStore';

export interface FacilityDetailRow {
  icon: IconName;
  label: string;
  value: string;
  /** 有語意的值（輪椅可用與否）上色；顏色之外文字本身就說明狀態。 */
  tone?: 'ok' | 'warn' | 'danger';
}

export type FacilityDetailModel =
  | { status: 'loading' }
  | { status: 'not-found' }
  | {
      status: 'ready';
      title: string;
      /** 「電梯 · 臺北捷運」（類別已在這裡，資料列不再重複） */
      eyebrow: string;
      rows: FacilityDetailRow[];
      planRouteLabel: string;
      onPlanRoute: () => void;
      showOnMapLabel: string;
      onShowOnMap: () => void;
      mismatchLabel: string;
      reportLabel: string;
      reportAccessibilityLabel: string;
      onReport: () => void;
    };

const SOURCE_KEY: Record<FacilitySource, string> = {
  metro: 'nativeFacilitySourceMetro',
  osm: 'nativeFacilitySourceOsm',
  campus: 'nativeFacilitySourceCampus',
  bathroom: 'nativeFacilitySourceBathroom',
  parking: 'nativeFacilitySourceParking',
};

function wheelchairRow(value: Facility['wheelchair']): Pick<FacilityDetailRow, 'value' | 'tone'> | null {
  if (value === 'yes') return { value: 'wheelchairYes', tone: 'ok' };
  if (value === 'limited') return { value: 'wheelchairLimited', tone: 'warn' };
  if (value === 'no') return { value: 'wheelchairNo', tone: 'danger' };
  return null;
}

/**
 * 設施詳情（設計 2a）。只列資料真的有的欄位——後端設施資料沒有運作狀態、樓層與開放時間，
 * 不顯示設計稿上的「運作中」膠囊，改由「現場跟資訊不一樣？回報」收集現場狀況。
 */
export function useFacilityDetail(id: string): FacilityDetailModel {
  const { t } = useAppTranslation();
  const facilities = useFacilityStore((state) => state.facilities);
  const position = useUserLocationStore((state) => state.position);
  if (!facilities) return { status: 'loading' };
  const facility = facilities.find((item) => item.id === id);
  if (!facility) return { status: 'not-found' };

  const rows: FacilityDetailRow[] = [];
  const place = facility.exitName ?? facility.schoolName;
  if (place) rows.push({ icon: 'mapPin', label: t(facility.exitName ? 'exitInfo' : 'nativeFacilityLocation'), value: place });
  const wheelchair = wheelchairRow(facility.wheelchair);
  if (wheelchair) rows.push({ icon: 'accessibility', label: t('wheelchairAccess'), value: t(wheelchair.value), tone: wheelchair.tone });
  const distanceText = position
    ? formatDistance(haversineMeters(position, { lat: facility.lat, lng: facility.lng }))
    : null;
  if (distanceText) rows.push({ icon: 'footprints', label: t('nativeDistance'), value: distanceText });

  return {
    status: 'ready',
    title: facility.name,
    eyebrow: `${t(facility.category)} · ${t(SOURCE_KEY[facility.source])}`,
    rows,
    planRouteLabel: t('planRoute'),
    onPlanRoute: () =>
      router.push({
        pathname: '/plan',
        params: { destLat: String(facility.lat), destLng: String(facility.lng), destName: facility.name },
      }),
    showOnMapLabel: t('nativeShowOnMap'),
    onShowOnMap: () => mapCamera.flyTo([facility.lng, facility.lat], 18),
    mismatchLabel: t('nativeFacilityMismatch'),
    reportLabel: t('nativeFacilityReport'),
    reportAccessibilityLabel: t('nativeFacilityReportLabel', { name: facility.name }),
    onReport: () =>
      router.push({
        pathname: '/hazard-report',
        params: {
          lat: String(facility.lat),
          lng: String(facility.lng),
          description: t('nativeFacilityReportDescription', { name: facility.name }),
        },
      }),
  };
}
