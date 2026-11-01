export type NearbyFacilityKind = 'toilet' | 'elevator' | 'ramp' | 'other';

export interface NearbyFacilityRow {
  key: string;
  name: string;
  address: string | null;
  typeLabel: string;
  /** 未回傳距離時不顯示距離，不能推測為 0。 */
  distanceText: string;
  kind: NearbyFacilityKind;
}

export interface NearbyFacilityLabels {
  toilet: string;
  elevator: string;
  ramp: string;
  other: string;
}

interface NearbyFacilityLists {
  nearbyBathroom: unknown[];
  nearbyMetroA11y: unknown[];
}

// 與 Web 相同：兩個來源各最多顯示四筆，廁所在前。
const ROWS_PER_SOURCE = 4;

function nonempty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim() || null;
}

function categoryKind(value: unknown): NearbyFacilityKind {
  switch (value) {
    case 'toilet':
    case 'accessible_toilet':
      return 'toilet';
    case 'elevator':
      return 'elevator';
    case 'ramp':
      return 'ramp';
    default:
      return 'other';
  }
}

function facilityKind(item: Record<string, unknown>): NearbyFacilityKind {
  const explicit = categoryKind(item.facType ?? item.category);
  if (explicit !== 'other' || item.source !== 'metro') return explicit;
  // 與後端 classifyMetroCategory 一致；只對捷運原始資料的指定名稱欄位判讀，
  // 校園資料的名稱與 facType 可能不同，不得據名稱覆蓋其類型。
  const metroName = nonempty(item['出入口電梯/無障礙坡道名稱']);
  if (metroName?.includes('電梯')) return 'elevator';
  if (metroName?.includes('坡道')) return 'ramp';
  return 'other';
}

function toRow(
  value: unknown,
  source: 'bathroom' | 'facility',
  index: number,
  formatDistance: (meters: number) => string,
  labels: NearbyFacilityLabels,
): NearbyFacilityRow | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const rawName = nonempty(item.displayName) ?? nonempty(item.name) ?? nonempty(item['出入口電梯/無障礙坡道名稱']);
  const rawType = nonempty(item.facTypeLabel) ?? nonempty(item.typeLabel);
  const rawId = item._id ?? item.facUid ?? item['項次'] ?? item.osmId ?? item.id;
  // 缺少識別、名稱與類型的物件不應被呈現成一筆設施。
  if (rawId == null && !rawName && !rawType) return null;
  const kind = source === 'bathroom' ? 'toilet' : facilityKind(item);
  const distance = item.distanceMeters;
  return {
    key: `${source}-${index}-${typeof rawId === 'string' || typeof rawId === 'number' ? rawId : ''}`,
    name: rawName ?? rawType ?? labels[kind],
    address: nonempty(item.displayAddress) ?? nonempty(item.address) ?? nonempty(item['出入口編號']),
    typeLabel: rawType ?? labels[kind],
    distanceText: typeof distance === 'number' && Number.isFinite(distance) && distance >= 0 ? formatDistance(distance) : '',
    kind,
  };
}

/** 根據 nearby-a11y 的兩份列表建立畫面列；metro 清單也含校園與 OSM 的多種設施。 */
export function nearbyFacilityRows(
  data: NearbyFacilityLists | null,
  formatDistance: (meters: number) => string,
  labels: NearbyFacilityLabels,
): NearbyFacilityRow[] {
  if (!data) return [];
  const convert = (items: unknown[], source: 'bathroom' | 'facility') => items
    .slice(0, ROWS_PER_SOURCE)
    .map((item, index) => toRow(item, source, index, formatDistance, labels))
    .filter((row): row is NearbyFacilityRow => row !== null);
  return [
    ...convert(data.nearbyBathroom, 'bathroom'),
    ...convert(data.nearbyMetroA11y, 'facility'),
  ];
}
