/**
 * 移植自 Web `src/types/place.ts`（commit 5eadc71）。與後端 place-search 契約對齊
 * （後端遷移指南 `docs/FRONTEND_MIGRATION_PLACE_SEARCH.md`）。
 */

export type PlaceSource = 'osm' | 'google';

export interface PlaceGeoPoint {
  type: 'Point';
  /** [lng, lat] */
  coordinates: [number, number];
}

export interface AutocompleteItem {
  id: string;
  source: PlaceSource;
  primaryText: string;
  secondaryText: string | null;
  placeClass: string | null;
  placeType: string | null;
  typeLabel: string | null;
  location: PlaceGeoPoint | null;
  distanceMeters: number | null;
}

export interface NearbyFacilityBrief {
  id: string;
  name: string;
  displayName?: string;
  displayAddress?: string;
  address: string | null;
  category: string;
  typeLabel: string;
  distanceMeters: number;
}

export interface PlaceAccessibility {
  status: 'accessible' | 'limited' | 'unknown';
  wheelchair: 'yes' | 'limited' | 'no' | null;
  nearbyFacilityCount: number;
  source: 'local-db' | 'google' | 'none';
}

export interface PlaceAddressComponents {
  road: string | null;
  district: string | null;
  city: string | null;
  postcode: string | null;
}

export type PlaceReviewType = 'osm' | 'a11y' | 'bathroom' | 'welfare' | 'parking' | 'google';

export interface PlaceReviewKey {
  placeId: string;
  placeType: PlaceReviewType;
}

export type PlaceBounds = [number, number, number, number];

export interface NearbyA11yCategoryStat {
  count: number;
  nearestMeters: number | null;
}

/** 後端 `GET /a11y/nearby-a11y` 依類別彙整的附近設施數量 */
export interface NearbyA11ySummary {
  elevator: NearbyA11yCategoryStat;
  ramp: NearbyA11yCategoryStat;
  toilet: NearbyA11yCategoryStat;
}

export interface PlaceResult {
  id: string;
  source: PlaceSource;
  name: string;
  fullAddress: string | null;
  addressComponents: PlaceAddressComponents;
  location: PlaceGeoPoint;
  /** [minLng, minLat, maxLng, maxLat]；舊快取或非 Google 來源沒有範圍 */
  bounds?: PlaceBounds | null;
  placeClass: string | null;
  placeType: string | null;
  typeLabel: string | null;
  distanceMeters: number | null;
  rating: number | null;
  accessibility: PlaceAccessibility;
  nearbyFacilities: {
    toilets: NearbyFacilityBrief[];
    metro: NearbyFacilityBrief[];
  };
  /** 反查地址／地圖點擊產生的地點不一定有穩定的評論 key。 */
  reviewKey: PlaceReviewKey | null;
  externalLinks: { osm: string | null; google: string | null };
  attribution: string | null;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** 場館地點以圖節點身分識別；同一座標的不同樓層不能合併。 */
export interface VenuePlaceDetail {
  kind: 'venue-place';
  venueId: string;
  placeId: string;
  placeKind: 'room' | 'amenity' | 'parking' | 'entrance' | 'gate' | 'anchor' | 'poi';
  name: string;
  venueName: string;
  buildingId: string | null;
  buildingName: string;
  levelRef: string | null;
  sourceVersion: number;
  dataSource: 'api';
  address: string;
  position: LatLng;
  arrivalKind: 'door' | 'corridor' | 'place' | null;
  doorKnown: boolean | null;
  wheelchair?: 'yes' | 'no' | 'limited' | 'unknown';
}

/**
 * 對齊 Web `src/types/index.ts` 的 `PlaceDetail`（原始碼未直接讀取，由
 * `adapters.ts`／`createSearchSlice.ts`／`SavedPlacesPanel.tsx` 的用法反推）：
 * 搜尋歷史、收藏、`infoShow`／`searchPlace` 都用這個 discriminated union，
 * `kind: "coordinate"` 是地圖點擊或反查失敗時的備援型別。
 */
export type PlaceDetail =
  | { kind: 'place'; place: PlaceResult; position: LatLng }
  | { kind: 'coordinate'; address: string; position: LatLng }
  | VenuePlaceDetail;

/**
 * 移植自 Web `src/lib/api/placeSearch.ts` 使用的 Nominatim 回應形狀
 * （反查 `reverseGeocode` 直接呼叫 Nominatim，非本 App 後端）。只列出
 * `nominatimToPlaceResult`／快取邏輯實際用到的欄位。
 */
// type（非 interface）才能指派給 formatNominatimPlace 的索引簽章
export type NominatimAddress = {
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  county?: string;
  city_district?: string;
  postcode?: string;
  house_number?: string;
  country?: string;
  country_code?: string;
};

export interface NominatimPlace {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  class?: string;
  category?: string;
  type?: string;
  address?: NominatimAddress;
}
