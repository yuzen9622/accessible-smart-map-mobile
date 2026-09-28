// 移植自 Web src/types/route.ts:18-52（A11yFacility）與 A11yFacilitiesWrapper.tsx:17-44（facilityToMarker）。
import type { Feature, FeatureCollection, Point } from 'geojson';

/** 地圖上有 pin 的設施類別（parking／other 不畫，停車另有圖層） */
export const PINNED_FACILITY_CATEGORIES = ['elevator', 'ramp', 'toilet'] as const;
export type PinnedFacilityCategory = (typeof PINNED_FACILITY_CATEGORIES)[number];

export type FacilitySource = 'metro' | 'osm' | 'campus' | 'bathroom' | 'parking';

export interface Facility {
  id: string;
  name: string;
  category: PinnedFacilityCategory;
  source: FacilitySource;
  lng: number;
  lat: number;
  /** 捷運出口名稱（source = metro） */
  exitName: string | null;
  /** OSM wheelchair 標籤（source = osm） */
  wheelchair: 'yes' | 'limited' | 'no' | null;
  /** 校園名稱（source = campus） */
  schoolName: string | null;
}

export interface FacilityFeatureProperties {
  id: string;
  name: string;
  category: PinnedFacilityCategory;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPinnedCategory(value: unknown): value is PinnedFacilityCategory {
  return typeof value === 'string' && (PINNED_FACILITY_CATEGORIES as readonly string[]).includes(value);
}

function isSource(value: unknown): value is FacilitySource {
  return (
    value === 'metro' || value === 'osm' || value === 'campus' || value === 'bathroom' || value === 'parking'
  );
}

function isWheelchair(value: unknown): value is 'yes' | 'limited' | 'no' {
  return value === 'yes' || value === 'limited' || value === 'no';
}

/** API 單筆 → Facility；非 pin 類別、缺欄位或座標非有限值時回傳 null（丟棄）。 */
export function parseFacility(item: unknown): Facility | null {
  if (!isRecord(item) || !isRecord(item.location)) return null;
  const { coordinates } = item.location;
  if (!Array.isArray(coordinates)) return null;
  const [lng, lat] = coordinates;
  if (typeof lng !== 'number' || typeof lat !== 'number' || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }
  if (typeof item._id !== 'string' || typeof item.name !== 'string') return null;
  if (!isPinnedCategory(item.category) || !isSource(item.source)) return null;
  return {
    id: item._id,
    name: item.name,
    category: item.category,
    source: item.source,
    lng,
    lat,
    exitName: typeof item.exitName === 'string' ? item.exitName : null,
    wheelchair: isWheelchair(item.wheelchair) ? item.wheelchair : null,
    schoolName: typeof item.schoolName === 'string' ? item.schoolName : null,
  };
}

export function parseFacilities(data: unknown): Facility[] {
  if (!Array.isArray(data)) return [];
  return data.map(parseFacility).filter((facility): facility is Facility => facility !== null);
}

/** 只保留 selected 類別的點；selected 為空時地圖不畫任何設施（對齊 Web 的 filter-gated 行為）。 */
export function toFacilityCollection(
  facilities: readonly Facility[],
  selected: ReadonlySet<PinnedFacilityCategory>,
): FeatureCollection<Point, FacilityFeatureProperties> {
  const features: Feature<Point, FacilityFeatureProperties>[] = [];
  for (const facility of facilities) {
    if (!selected.has(facility.category)) continue;
    features.push({
      type: 'Feature',
      id: facility.id,
      geometry: { type: 'Point', coordinates: [facility.lng, facility.lat] },
      properties: { id: facility.id, name: facility.name, category: facility.category },
    });
  }
  return { type: 'FeatureCollection', features };
}
