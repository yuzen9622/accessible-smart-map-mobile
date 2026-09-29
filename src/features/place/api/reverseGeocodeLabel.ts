import { nominatimToPlaceResult } from '../domain/adapters';
import { toApiLang } from '../domain/lang';
import { reverseGeocode } from './reverseGeocode';

/**
 * 給其他 feature（SOS、危險通報）用的「座標 → 一行地址」。失敗或查無結果回傳 null，呼叫端自行顯示座標。
 * 共用 `reverseGeocode` 的 5 分鐘快取；呼叫端仍應自行節流（Nominatim 約 1 req/s）。
 */
export async function reverseGeocodeLabel(lat: number, lng: number, language: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const place = await reverseGeocode({ lat, lng, lang: toApiLang(language) ?? 'zh-TW', zoom: 18, signal });
    if (!place) return null;
    const result = nominatimToPlaceResult(place);
    return result.fullAddress ?? result.name ?? null;
  } catch {
    return null;
  }
}
