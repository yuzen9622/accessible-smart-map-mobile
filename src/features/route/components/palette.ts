// 數值一律來自 `@/shared/theme` 的設計規範（tokens.ts），這裡只保留各 feature 既有的常數名稱。
import { StyleSheet } from 'react-native';
import { ACCENT_FILL, ON_ACCENT_FILL, RADIUS, semanticColors } from '@/shared/theme';

/**
 * 路線面板的色票與共用版型。與 place 面板（`features/place/components/palette.ts`）同一套數值，
 * 讓 sheet 內各面板視覺一致；`@/shared/theme` 目前只有四個文字／底色 token，
 * 擴充共用 token 影響面大，沿用 place 的做法在 feature 內固定色值。
 */
export const ROUTE_ACCENT_COLOR = ACCENT_FILL;
export const ROUTE_ACCENT_COLOR_DARK = semanticColors(true).accent;
export const ROUTE_ON_ACCENT_COLOR = ON_ACCENT_FILL;
export const ROUTE_BORDER_COLOR = 'rgba(120, 120, 128, 0.3)';
export const ROUTE_SURFACE_COLOR = semanticColors(false).neutral.bg;
export const ROUTE_WARN_COLOR = semanticColors(false).warn.fg;
export const ROUTE_WARN_COLOR_DARK = semanticColors(true).warn.fg;
export const ROUTE_WARN_SURFACE = semanticColors(false).warn.bg;
export const ROUTE_OK_COLOR = semanticColors(false).ok.fg;
export const ROUTE_OK_COLOR_DARK = semanticColors(true).ok.fg;
export const ROUTE_OK_SURFACE = semanticColors(false).ok.bg;
export const ROUTE_DANGER_COLOR = semanticColors(false).danger.fg;
export const ROUTE_DANGER_COLOR_DARK = semanticColors(true).danger.fg;
export const ROUTE_DANGER_SURFACE = semanticColors(false).danger.bg;

export interface RouteTones {
  accent: string;
  ok: string;
  warn: string;
  danger: string;
}

export function routeTones(isDark: boolean): RouteTones {
  return isDark
    ? { accent: ROUTE_ACCENT_COLOR_DARK, ok: ROUTE_OK_COLOR_DARK, warn: ROUTE_WARN_COLOR_DARK, danger: ROUTE_DANGER_COLOR_DARK }
    : { accent: ROUTE_ACCENT_COLOR, ok: ROUTE_OK_COLOR, warn: ROUTE_WARN_COLOR, danger: ROUTE_DANGER_COLOR };
}

export const routeStyles = StyleSheet.create({
  // paddingTop 多留一點：透明導覽列底緣的 scroll-edge 效果會蓋到第一行
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32, gap: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  section: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '600' },
  bodyText: { fontSize: 14 },
  metaText: { fontSize: 13 },
  card: { borderRadius: RADIUS.card, padding: 14, gap: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
  },
  chipText: { fontSize: 14, fontWeight: '500' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28, borderRadius: 14, paddingHorizontal: 10 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 16,
    backgroundColor: ROUTE_ACCENT_COLOR,
  },
  primaryButtonText: { color: ROUTE_ON_ACCENT_COLOR, fontSize: 16, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
