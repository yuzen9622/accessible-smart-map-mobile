import type { PlaceAccessibility, PlaceResult } from '../types/place';

export interface PlaceBadge {
  key: 'type' | 'a11y';
  label: string;
  tone: 'neutral' | 'ok' | 'warn';
  iconName: 'accessibility' | null;
}

const A11Y_BADGE: Record<PlaceAccessibility['status'], { tone: PlaceBadge['tone']; labelKey: string }> = {
  accessible: { tone: 'ok', labelKey: 'a11yBadgeAccessible' },
  limited: { tone: 'warn', labelKey: 'a11yBadgeLimited' },
  unknown: { tone: 'warn', labelKey: 'a11yBadgeUnknown' },
};

/**
 * 地點詳情標頭的 meta chips（對齊 Web `PlaceContent.tsx`：類型 → 無障礙總體狀態）。
 * 後端 `isPlaceResult` 只驗 id／name／location，`accessibility` 可能缺值，
 * 所以這裡防禦性讀取，缺值與未知狀態一律視為「未確認」。
 */
export function buildPlaceBadges(place: PlaceResult | null, t: (key: string) => string): PlaceBadge[] {
  if (!place) return [];
  const badges: PlaceBadge[] = [];
  if (place.typeLabel) {
    badges.push({ key: 'type', label: place.typeLabel, tone: 'neutral', iconName: null });
  }
  const accessibility: Partial<PlaceAccessibility> | undefined = place.accessibility;
  const status = accessibility?.status;
  const a11y = (status && A11Y_BADGE[status]) ?? A11Y_BADGE.unknown;
  badges.push({ key: 'a11y', label: t(a11y.labelKey), tone: a11y.tone, iconName: 'accessibility' });
  return badges;
}
