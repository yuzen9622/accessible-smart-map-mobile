import type { Href } from 'expo-router';

import { isCoordPlaceId } from '../domain/placeId';
import type { PlaceDetail } from '../types/place';

/**
 * 地點詳情要開哪個路由：有真正地點 id 走 `/place/[id]`；座標型（含 `coord:` id）
 * 一律走 `/loc/[coords]` 反查——`/place/[id]` 不會對 coord: 發 details 請求，只會停在錯誤畫面。
 */
export function placeDetailHref(entry: PlaceDetail): Href {
  if (entry.kind === 'place' && !isCoordPlaceId(entry.place.id)) {
    return { pathname: '/place/[id]', params: { id: entry.place.id } };
  }
  return { pathname: '/loc/[coords]', params: { coords: `${entry.position.lat},${entry.position.lng}` } };
}
