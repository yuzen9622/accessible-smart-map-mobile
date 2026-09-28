import { placeKey } from './placeKey';
import type { LatLng, NominatimPlace, PlaceDetail, PlaceResult } from '../types/place';

/**
 * 移植自 Web `src/lib/place/adapters.ts`（commit 5eadc71，逐行搬移，型別改寫
 * 成本 repo 的 `PlaceDetail`／`PlaceResult`）。
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLatLng(value: unknown): value is LatLng {
  return (
    isRecord(value) &&
    typeof value.lat === 'number' &&
    Number.isFinite(value.lat) &&
    typeof value.lng === 'number' &&
    Number.isFinite(value.lng)
  );
}

function isLegacyNominatimPlace(value: unknown): value is NominatimPlace {
  return (
    isRecord(value) &&
    typeof value.lat === 'string' &&
    typeof value.lon === 'string' &&
    typeof value.display_name === 'string'
  );
}

function placeDetailKey(place: PlaceDetail): string {
  return placeKey(place);
}

/** 計算**舊格式**的 key（`p_{place_id}` 或 `c_{lat}_{lng}`），只用來在遷移時查舊分類。 */
function legacyPlaceDetailKey(raw: unknown): string | null {
  if (!isRecord(raw)) return null;
  if (raw.kind === 'place' && isRecord(raw.place)) {
    const placeId = raw.place.place_id;
    if (typeof placeId === 'string' || typeof placeId === 'number') {
      return `p_${placeId}`;
    }
    return null;
  }
  if (raw.kind === 'coordinate' && isLatLng(raw.position)) {
    return `c_${raw.position.lat}_${raw.position.lng}`;
  }
  return null;
}

export function nominatimToPlaceResult(p: NominatimPlace): PlaceResult {
  const hasOsmReference = Boolean(p.osm_type) && p.osm_id !== undefined;
  const osmType = p.osm_type ?? '';
  const osmId = p.osm_id === undefined ? '' : String(p.osm_id);
  const address = p.address ?? {};

  return {
    id: hasOsmReference ? `osm:${osmType}:${osmId}` : `coord:${p.lat},${p.lon}`,
    source: 'osm',
    name: p.name || p.display_name,
    fullAddress: p.display_name,
    addressComponents: {
      road: address.road ?? null,
      district: address.suburb ?? address.neighbourhood ?? null,
      city: address.city ?? address.town ?? address.county ?? null,
      postcode: address.postcode ?? null,
    },
    location: {
      type: 'Point',
      coordinates: [Number(p.lon), Number(p.lat)],
    },
    placeClass: p.class ?? p.category ?? null,
    placeType: p.type ?? null,
    typeLabel: null,
    distanceMeters: null,
    rating: null,
    accessibility: {
      status: 'unknown',
      wheelchair: null,
      nearbyFacilityCount: 0,
      source: 'none',
    },
    nearbyFacilities: { toilets: [], metro: [] },
    reviewKey: hasOsmReference ? { placeId: `${osmType}/${osmId}`, placeType: 'osm' } : null,
    externalLinks: {
      osm: hasOsmReference ? `https://www.openstreetmap.org/${osmType}/${osmId}` : null,
      google: null,
    },
    attribution: '© OpenStreetMap contributors',
  };
}

export function legacyPlaceDetailToPlaceResult(raw: unknown): PlaceDetail | null {
  if (!isRecord(raw)) return null;

  // Coordinate 條目沒有巢狀 place 物件，原樣相容。
  if (raw.kind === 'coordinate') {
    if (typeof raw.address !== 'string' || !isLatLng(raw.position)) return null;
    return raw as unknown as PlaceDetail;
  }

  if (raw.kind !== 'place' || !isLegacyNominatimPlace(raw.place) || !isLatLng(raw.position)) {
    return null;
  }

  return {
    kind: 'place',
    place: nominatimToPlaceResult(raw.place),
    position: raw.position,
  };
}

export interface LegacyPlaceStorageInput {
  searchHistory: unknown;
  savedPlaces: unknown;
  savedPlaceCategories: unknown;
}

export interface LegacyPlaceStorageOutput {
  searchHistory: PlaceDetail[];
  savedPlaces: PlaceDetail[];
  savedPlaceCategories: Record<string, string>;
}

/**
 * 移植自 Web `client-layout.tsx` 呼叫的遷移函式本體（純邏輯部分；「讀舊 key、
 * 寫新 key、失敗回滾」交給呼叫端用 `shared/storage` 的
 * `commitVersionedWrite`／`readJson` 處理，見 `store/savedPlacesStore.ts`）。
 */
export function migrateLegacyPlaceStorage({
  searchHistory,
  savedPlaces,
  savedPlaceCategories,
}: LegacyPlaceStorageInput): LegacyPlaceStorageOutput {
  const migrateList = (entries: unknown): PlaceDetail[] =>
    Array.isArray(entries)
      ? entries.map(legacyPlaceDetailToPlaceResult).filter((entry): entry is PlaceDetail => entry !== null)
      : [];

  const migratedHistory = migrateList(searchHistory);
  const categoryMap = isRecord(savedPlaceCategories) ? savedPlaceCategories : {};
  const migratedSavedPlaces: PlaceDetail[] = [];
  const migratedCategories: Record<string, string> = {};

  if (Array.isArray(savedPlaces)) {
    for (const raw of savedPlaces) {
      const oldKey = legacyPlaceDetailKey(raw);
      const migrated = legacyPlaceDetailToPlaceResult(raw);
      if (!migrated) continue;

      migratedSavedPlaces.push(migrated);
      const newKey = placeDetailKey(migrated);
      const category = oldKey ? categoryMap[oldKey] : undefined;
      if (newKey && typeof category === 'string') {
        migratedCategories[newKey] = category;
      }
    }
  }

  return {
    searchHistory: migratedHistory,
    savedPlaces: migratedSavedPlaces,
    savedPlaceCategories: migratedCategories,
  };
}
