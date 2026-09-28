import type { PlaceDetail } from '../types/place';

/**
 * 移植自 Web `src/components/BottomSheet/PlaceContent.tsx:207-227`
 * `handleShare`（commit 5eadc71）的 URL 組法（拿掉 DOM 的
 * `navigator.share`／`clipboard` 呼叫，那部分交給呼叫端用 RN `Share.share`／
 * `expo-clipboard`）。
 *
 * 規則：`place` 且 id 是 `osm:`／`google:` 開頭 → `?place={id}`；否則
 * （coordinate-kind，或沒有那兩種前綴的 place id）→ `?loc={lat},{lng}`。
 */
export function buildPlaceShareUrl(shareBaseUrl: string, entry: PlaceDetail): string {
  const base = shareBaseUrl.replace(/\/+$/, '');
  if (entry.kind === 'place' && (entry.place.id.startsWith('osm:') || entry.place.id.startsWith('google:'))) {
    return `${base}?place=${encodeURIComponent(entry.place.id)}`;
  }
  return `${base}?loc=${entry.position.lat},${entry.position.lng}`;
}
