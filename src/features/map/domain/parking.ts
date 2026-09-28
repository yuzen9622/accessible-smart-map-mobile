// 移植自 Web src/types/route.ts:684-736（DisabledParking／ParkingSpaceNearby／
// ParkingLotNearby／ParkingNearbyItem）、src/types/route.ts:931-940
// （formatDistance）與 src/components/BottomSheet/ParkingPanel.tsx（
// carParkTypeLabel／chargeTypesLabels／parkingItemLngLat，commit 5eadc71）。

import { lngLatToLatLng, type LatLng } from '@/shared/geo';

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

// --- Disabled Parking (from /a11y/parking/nearby) ---
export interface DisabledParking {
  _id: string;
  city: string;
  district: string;
  areacode?: string;
  quantity: number;
  placeName: string;
  chargeType?: string;
  spaceLabel?: string;
  isMarked: boolean;
  location: GeoPoint;
  importedAt: string;
}

/** On-street parking space（身障/一般路邊停車格）。 */
export interface ParkingSpaceNearby extends DisabledParking {
  type: 'disabled' | 'standard';
  /** 一般停車格所屬路段代碼（僅 standard）。 */
  segmentId?: string;
  /** 一般停車格車格類型代碼（僅 standard）。 */
  spaceType?: number;
  /** 一般停車格是否附充電座（僅 standard）。 */
  hasChargingPoint?: boolean;
}

/** Parking lot imported from TDX（停車場，如城市車旅/捷運轉乘站）。 */
export interface ParkingLotNearby {
  type: 'lot';
  _id: string;
  carParkId: string;
  name: string;
  address?: string;
  city: string;
  district?: string;
  /** 1 平面 / 2 立體 / 3 地下 / 4 停車塔 / 5 機械式。 */
  carParkType?: number;
  /** 收費方式：1 計時 / 2 計次 / 3 月租 / 4 免費（255 未知）。 */
  chargeTypes?: number[];
  wheelchairAccessible?: boolean;
  disabledSpaces?: number;
  totalCarSpaces?: number;
  location: GeoPoint;
  importedAt: string;
}

export type ParkingNearbyItem = ParkingSpaceNearby | ParkingLotNearby;

/** 移植自 Web src/types/route.ts:931-940，四捨五入規則逐條對齊。 */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return '';
  // >=100km: whole km, a decimal place is false precision at that range.
  if (meters >= 100_000) return `${Math.round(meters / 1000)} km`;
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  // Below 10m the round-to-10 rule renders a real 4m step as "0 m", which
  // reads as no movement at all — the CSR engine emits plenty of these.
  if (meters < 10) return `${Math.round(meters)} m`;
  // Round to the nearest 10m — "583 m" implies GPS accuracy this app
  // doesn't have; "580 m" reads as the estimate it actually is.
  return `${Math.round(meters / 10) * 10} m`;
}

/** TDX CarParkType：1 平面 / 2 立體 / 3 地下 / 4 停車塔 / 5 機械式。 */
export function carParkTypeLabel(
  t: (key: string, opts?: Record<string, unknown>) => string,
  type?: number,
): string | null {
  switch (type) {
    case 1:
      return t('parkingTypeSurface');
    case 2:
      return t('parkingTypeMultiStory');
    case 3:
      return t('parkingTypeUnderground');
    case 4:
      return t('parkingTypeTower');
    case 5:
      return t('parkingTypeMechanical');
    default:
      return null;
  }
}

/**
 * TDX ChargeTypes：1 計時 / 2 計次 / 3 月租 / 4 免費。
 * 其它值（如 TDX 未知 sentinel 255）沒有實際資訊，直接略過不顯示。
 */
export function chargeTypesLabels(
  t: (key: string, opts?: Record<string, unknown>) => string,
  types?: number[],
): { code: number; label: string }[] {
  if (!types?.length) return [];
  return types.flatMap((code) => {
    let label: string | null;
    switch (code) {
      case 1:
        label = t('chargeTypeHourly');
        break;
      case 2:
        label = t('chargeTypePerEntry');
        break;
      case 3:
        label = t('chargeTypeMonthly');
        break;
      case 4:
        label = t('chargeTypeFree');
        break;
      default:
        label = null;
    }
    return label ? [{ code, label }] : [];
  });
}

/**
 * 取出任一種停車項目的座標；停車場與路邊格位都只有 GeoJSON `location`。
 * Web 版用 `geoCoords(item.location)`；本版改用共用層 `lngLatToLatLng` 再換欄位順序，
 * 兩者對「座標缺漏／非有限值回傳 null」的行為一致。
 */
export function parkingItemLngLat(item: ParkingNearbyItem): { lng: number; lat: number } | null {
  const coords: LatLng | null = lngLatToLatLng(item.location?.coordinates);
  if (!coords) return null;
  return { lng: coords.lng, lat: coords.lat };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteCoordinates(location: unknown): location is GeoPoint {
  if (!isRecord(location)) return false;
  const { coordinates } = location;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return false;
  const [lng, lat] = coordinates;
  return typeof lng === 'number' && typeof lat === 'number' && Number.isFinite(lng) && Number.isFinite(lat);
}

function parseParkingSpace(item: Record<string, unknown>): ParkingSpaceNearby | null {
  if (item.type !== 'disabled' && item.type !== 'standard') return null;
  if (typeof item._id !== 'string') return null;
  if (typeof item.city !== 'string' || typeof item.district !== 'string') return null;
  if (typeof item.quantity !== 'number' || typeof item.placeName !== 'string') return null;
  if (typeof item.isMarked !== 'boolean') return null;
  if (!isFiniteCoordinates(item.location)) return null;
  if (typeof item.importedAt !== 'string') return null;
  return {
    type: item.type,
    _id: item._id,
    city: item.city,
    district: item.district,
    areacode: typeof item.areacode === 'string' ? item.areacode : undefined,
    quantity: item.quantity,
    placeName: item.placeName,
    chargeType: typeof item.chargeType === 'string' ? item.chargeType : undefined,
    spaceLabel: typeof item.spaceLabel === 'string' ? item.spaceLabel : undefined,
    isMarked: item.isMarked,
    location: item.location as GeoPoint,
    importedAt: item.importedAt,
    segmentId: typeof item.segmentId === 'string' ? item.segmentId : undefined,
    spaceType: typeof item.spaceType === 'number' ? item.spaceType : undefined,
    hasChargingPoint: typeof item.hasChargingPoint === 'boolean' ? item.hasChargingPoint : undefined,
  };
}

function parseParkingLot(item: Record<string, unknown>): ParkingLotNearby | null {
  if (item.type !== 'lot') return null;
  if (typeof item._id !== 'string' || typeof item.carParkId !== 'string') return null;
  if (typeof item.name !== 'string' || typeof item.city !== 'string') return null;
  if (!isFiniteCoordinates(item.location)) return null;
  if (typeof item.importedAt !== 'string') return null;
  const chargeTypes = Array.isArray(item.chargeTypes)
    ? item.chargeTypes.filter((code): code is number => typeof code === 'number')
    : undefined;
  return {
    type: 'lot',
    _id: item._id,
    carParkId: item.carParkId,
    name: item.name,
    address: typeof item.address === 'string' ? item.address : undefined,
    city: item.city,
    district: typeof item.district === 'string' ? item.district : undefined,
    carParkType: typeof item.carParkType === 'number' ? item.carParkType : undefined,
    chargeTypes,
    wheelchairAccessible: typeof item.wheelchairAccessible === 'boolean' ? item.wheelchairAccessible : undefined,
    disabledSpaces: typeof item.disabledSpaces === 'number' ? item.disabledSpaces : undefined,
    totalCarSpaces: typeof item.totalCarSpaces === 'number' ? item.totalCarSpaces : undefined,
    location: item.location as GeoPoint,
    importedAt: item.importedAt,
  };
}

function parseParkingItem(item: unknown): ParkingNearbyItem | null {
  if (!isRecord(item)) return null;
  return parseParkingSpace(item) ?? parseParkingLot(item);
}

/** 型別守衛：narrow API 回傳的陣列，丟棄格式不符的項目。 */
export function parseParkingItems(data: unknown): ParkingNearbyItem[] {
  if (!Array.isArray(data)) return [];
  return data.map(parseParkingItem).filter((item): item is ParkingNearbyItem => item !== null);
}
