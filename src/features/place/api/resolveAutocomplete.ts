import { isCoordPlaceId } from '../domain/placeId';
import type { AutocompleteItem } from '../types/place';
import { getPlaceDetails } from './placeSearch';

export interface ResolvedPlace {
  lat: number;
  lng: number;
  name: string;
}

/**
 * 自動完成選項 → 座標與名稱（對齊 Web `PlaceInput` 選取建議時的行為：有座標直接用，否則查詳情）。
 * 給路線規劃等「只需要一個點」的呼叫端用，不開地點詳情面板。
 */
export async function resolveAutocompleteItem(
  item: AutocompleteItem,
  sessiontoken?: string,
  signal?: AbortSignal,
): Promise<ResolvedPlace | null> {
  const name = item.primaryText;
  if (item.location) {
    const [lng, lat] = item.location.coordinates;
    return { lat, lng, name };
  }
  if (isCoordPlaceId(item.id)) return null;
  const response = await getPlaceDetails(item.id, { sessiontoken }, signal);
  const coords = response.data?.location.coordinates;
  if (!coords) return null;
  return { lat: coords[1], lng: coords[0], name: response.data?.name || name };
}
