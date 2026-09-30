// 移植自 Web `src/lib/aiResults.ts`（commit f5027af），加上它依賴的 `src/lib/utils.ts` 的 `geoCoords`／`formatMetroA11y`／
// `formatBathroom` 純函式部分。Web 用 `Record<string, any>` 做防禦式存取；本 repo 禁 any，改用 `unknown` + 取值 helper。
// 使用者可見的中文（「地點」「無障礙設施」「有提供尿布台」…）改由注入的 `t` 產生。
import type { AiMarker } from './uiAction';
import type { LatLng } from '@/shared/geo';
import type { Translate } from './types';

type Rec = Record<string, unknown>;

export function isRec(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null;
}

/** 沿 path 取值；中途遇到非物件就回 undefined（等同 Web 的 `a?.b?.c`）。 */
export function at(v: unknown, ...path: string[]): unknown {
  let cur: unknown = v;
  for (const key of path) {
    if (!isRec(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

/** 非空字串才算有值（Web 用 `a || b` 串接，對字串欄位語意相同）。 */
export function firstStr(...values: unknown[]): string {
  for (const v of values) if (typeof v === 'string' && v) return v;
  return '';
}

export function asRecArray(v: unknown): Rec[] {
  return Array.isArray(v) ? v.filter(isRec) : [];
}

/**
 * 後端資料集曾用扁平的 經度/緯度 或 latitude/longitude，新版只有 GeoJSON `location.coordinates` [lng, lat]，兩種都收。
 */
export function geoCoords(
  location: unknown,
  legacyLat?: number | string,
  legacyLng?: number | string,
): LatLng | null {
  const finite = (lat: unknown, lng: unknown): LatLng | null => {
    const la = parseFloat(String(lat));
    const ln = parseFloat(String(lng));
    return Number.isFinite(la) && Number.isFinite(ln) ? { lat: la, lng: ln } : null;
  };
  const c = at(location, 'coordinates');
  if (Array.isArray(c) && c.length >= 2) {
    const fromGeo = finite(c[1], c[0]);
    if (fromGeo) return fromGeo;
  }
  return finite(legacyLat, legacyLng);
}

/**
 * 防禦式座標偵測：依序嘗試多種常見欄位命名，回傳 LatLng 或 null。
 * 座標數值僅供地圖定位/開詳情使用，不會渲染給使用者看。
 */
export function getLatLng(item: unknown): LatLng | null {
  if (!isRec(item)) return null;

  const toNum = (v: unknown): number | null => {
    if (typeof v === 'number') return Number.isNaN(v) ? null : v;
    if (typeof v === 'string') {
      const n = parseFloat(v);
      return Number.isNaN(n) ? null : n;
    }
    return null;
  };
  const pair = (lat: unknown, lng: unknown): LatLng | null => {
    const la = toNum(lat);
    const ln = toNum(lng);
    return la !== null && ln !== null ? { lat: la, lng: ln } : null;
  };
  // GeoJSON 座標陣列為 [lng, lat]
  const coords = (c: unknown): LatLng | null => (Array.isArray(c) && c.length >= 2 ? pair(c[1], c[0]) : null);
  const pairAt = (latPath: string[], lngPath: string[]): LatLng | null =>
    pair(at(item, ...latPath), at(item, ...lngPath));

  return (
    pairAt(['geometry', 'location', 'lat'], ['geometry', 'location', 'lng']) ??
    pairAt(['geometry', 'location', 'latitude'], ['geometry', 'location', 'longitude']) ??
    pairAt(['location', 'lat'], ['location', 'lng']) ??
    pairAt(['location', 'latitude'], ['location', 'longitude']) ??
    pairAt(['position', 'lat'], ['position', 'lng']) ??
    pairAt(['position', 'latitude'], ['position', 'longitude']) ??
    pairAt(['lat'], ['lng']) ??
    pairAt(['latitude'], ['longitude']) ??
    pairAt(['lat'], ['lon']) ??
    pairAt(['緯度'], ['經度']) ??
    pairAt(['PositionLat'], ['PositionLon']) ??
    pairAt(['StopPosition', 'PositionLat'], ['StopPosition', 'PositionLon']) ??
    pairAt(['BusPosition', 'PositionLat'], ['BusPosition', 'PositionLon']) ??
    coords(at(item, 'location', 'coordinates')) ??
    coords(at(item, 'position', 'coordinates')) ??
    coords(at(item, 'reportedLocation', 'coordinates')) ??
    coords(at(item, 'geometry', 'coordinates')) ??
    coords(at(item, 'coordinates')) ??
    null
  );
}

export function isOk(res: unknown): res is Rec {
  if (!isRec(res)) return false;
  if (res.ok === false) return false;
  if (res.status && res.status !== 'OK') return false;
  return true;
}

function dedupe(markers: AiMarker[]): AiMarker[] {
  const seen = new Map<string, AiMarker>();
  for (const m of markers) if (!seen.has(m.id)) seen.set(m.id, m);
  return Array.from(seen.values());
}

/** findGooglePlaces 結果 → 可點標記（開地點詳情）。 */
export function googlePlacesToMarkers(res: unknown, t: Translate): AiMarker[] {
  if (!isOk(res) || !Array.isArray(res.places)) return [];

  const markers: AiMarker[] = [];
  res.places.forEach((place: unknown, i: number) => {
    const pos = getLatLng(place);
    if (!pos || !isRec(place)) return;
    const name = firstStr(place.name, place.formatted_address) || t('nativeAiPlaceFallback');
    const googlePlaceId = typeof place.place_id === 'string' && place.place_id ? place.place_id : undefined;
    const fullAddress = typeof place.formatted_address === 'string' ? place.formatted_address : name;
    const firstType = Array.isArray(place.types) ? place.types[0] : undefined;
    const placeType =
      typeof firstType === 'string' ? firstType : typeof place.type === 'string' ? place.type : undefined;

    markers.push({
      id: `g_${googlePlaceId ?? i}`,
      position: pos,
      title: name,
      subtitle: fullAddress,
      kind: 'place',
      googlePlaceId,
      placeType,
      rating: typeof place.rating === 'number' ? place.rating : undefined,
    });
  });

  return dedupe(markers);
}

const METRO_NAME_KEY = '出入口電梯/無障礙坡道名稱';

/** 對應 Web `formatMetroA11y`。 */
function metroToMarkers(items: Rec[]): AiMarker[] {
  return items.flatMap((place, i) => {
    const position = geoCoords(
      place.location,
      place['緯度'] as number | string | undefined,
      place['經度'] as number | string | undefined,
    );
    if (!position) return [];
    const name = typeof place[METRO_NAME_KEY] === 'string' ? place[METRO_NAME_KEY] : '';
    const id = firstStr(place._id, place.osmId) || `metro_${i}`;
    const code = place['出入口編號'];
    return {
      id,
      position,
      title: name,
      subtitle: typeof code === 'string' && code ? code : undefined,
      kind: name.includes('電梯') ? 'elevator' : 'ramp',
    } satisfies AiMarker;
  });
}

/** 對應 Web `formatBathroom`。 */
function bathroomToMarkers(items: Rec[], t: Translate): AiMarker[] {
  return items.flatMap((bathroom, i) => {
    const position = geoCoords(
      bathroom.location,
      bathroom.latitude as number | string | undefined,
      bathroom.longitude as number | string | undefined,
    );
    if (!position) return [];
    return {
      id: firstStr(bathroom._id) || `bath_${i}`,
      position,
      title: firstStr(bathroom.name),
      subtitle: bathroom.diaper ? t('nativeAiDiaperYes') : t('nativeAiDiaperNo'),
      kind: 'restroom',
    } satisfies AiMarker;
  });
}

/** findA11yPlaces 結果 → 可點標記（依座標載入周邊設施）。 */
export function a11yPlacesToMarkers(res: unknown, t: Translate): AiMarker[] {
  if (!isOk(res)) return [];
  const places = isRec(res.places) ? res.places : {};
  const nearbyBathroom = asRecArray(places.nearbyBathroom);
  const nearbyOsm = asRecArray(places.nearbyOsm);
  const nearbyMetroA11y = asRecArray(places.nearbyMetroA11y);
  const nearbyParking = asRecArray(places.nearbyParking);

  const markers: AiMarker[] = [];
  const push = (m: AiMarker) => {
    if (Number.isNaN(m.position.lat) || Number.isNaN(m.position.lng)) return;
    markers.push({ ...m, title: m.title || t('nativeAiA11yFacilities') });
  };

  // 已知形狀 → 對應既有 formatter（內部會過濾無座標項目）
  metroToMarkers(nearbyMetroA11y.filter((m) => m[METRO_NAME_KEY])).forEach(push);
  bathroomToMarkers(
    nearbyBathroom.filter((b) => b.name),
    t,
  ).forEach(push);

  // 未知形狀（osm / parking）→ 防禦式建 Marker
  [...nearbyOsm, ...nearbyParking].forEach((item, i) => {
    const pos = getLatLng(item);
    if (!pos) return;
    const rawId = item.id ?? item._id ?? item.osmId ?? `a_${i}`;
    push({
      id: String(rawId),
      position: pos,
      title: firstStr(item.name, item.placeName, at(item, 'tags', 'name')),
      subtitle:
        firstStr(item.address, item.spaceLabel, at(item, 'tags', 'amenity'), item.type) || undefined,
      kind: 'facility',
    });
  });

  return dedupe(markers);
}
