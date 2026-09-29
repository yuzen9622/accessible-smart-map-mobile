import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { formatDistance } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';
import { RADIUS, TYPE, useThemeColors } from '@/shared/theme';
import { Icon, type IconName } from '@/shared/ui';

import {
  effectiveAccessibilityScore,
  getConfidenceLabelKey,
  getRouteAlertsCount,
  legChainSegments,
  routeSummary,
  type Translate,
} from '../domain/routeCard';
import { LEG_LABEL_FILL, formatDuration, scoreToStars } from '../domain/routeDisplay';
import type { AccessibleRoute, RouteLeg } from '../types/route';
import {
  ROUTE_ACCENT_COLOR,
  ROUTE_BORDER_COLOR,
  ROUTE_DANGER_SURFACE,
  ROUTE_SURFACE_COLOR,
  ROUTE_WARN_SURFACE,
  routeStyles,
  routeTones,
} from './palette';

export const LEG_ICON: Record<RouteLeg['type'], IconName> = {
  WALK: 'footprints',
  BUS: 'bus',
  METRO: 'tramFront',
  THSR: 'trainFrontTunnel',
  TRA: 'trainFront',
  DRIVE: 'car',
  MOTORCYCLE: 'bike',
};

export interface RouteCardProps {
  route: AccessibleRoute;
  selected: boolean;
  onSelect: () => void;
  onOpenDetail: () => void;
}

const STAR_TONE: Record<number, 'ok' | 'warn' | 'danger'> = { 5: 'ok', 4: 'ok', 3: 'warn', 2: 'warn', 1: 'danger' };
/** 選中時最多列出幾條無障礙亮點；其餘收成「還有 N 項」，完整清單在路線詳情。 */
const MAX_HIGHLIGHTS = 3;

/**
 * 路線卡（Web `RouteCard.tsx`）：總時間、運具串、星等；選中時展開轉乘、步行距離、資料可信度、
 * 無障礙亮點與警告，並提供「路線詳情」入口。整張卡一個 `accessibilityLabel` 念出完整摘要（SDD §4.5）。
 */
export default function RouteCard({ route, selected, onSelect, onOpenDetail }: RouteCardProps) {
  const colors = useThemeColors();
  const tones = routeTones(useColorScheme() === 'dark');
  const { t } = useAppTranslation();
  const translate = t as Translate;

  const duration = formatDuration(route.totalMinutes);
  const summary = routeSummary(route.legs, translate);
  const alerts = getRouteAlertsCount(route);
  const score = effectiveAccessibilityScore(route);
  const stars = score === null ? null : scoreToStars(score);
  const starText = stars === null ? null : t(`starLabel${stars}`);
  const confidenceKey = getConfidenceLabelKey(route.dataConfidence);
  const chain = legChainSegments(route.legs);
  // 警示類（請留意／無法）排前面再截取，不能被擠進「還有 N 項」
  const isCaution = (text: string) => text.includes('請留意') || text.includes('無法');
  const ordered = [...route.accessibilityHighlights].sort((a, b) => Number(isCaution(b)) - Number(isCaution(a)));
  const highlights = ordered.slice(0, MAX_HIGHLIGHTS);
  const hiddenHighlights = route.accessibilityHighlights.length - highlights.length;
  const facts = [
    route.transferCount > 0 ? t('transferCount', { count: route.transferCount }) : null,
    route.totalWalkDistanceM != null ? t('totalWalkDistance', { distance: formatDistance(route.totalWalkDistanceM) }) : null,
    confidenceKey ? `${t('dataConfidence')}：${t(confidenceKey)}` : null,
  ].filter(Boolean);

  const a11ySummary = [
    route.routeName,
    duration,
    summary,
    starText,
    alerts > 0 ? t('routeTransitAlertsBadge', { count: alerts }) : null,
    selected ? t('selectedRoute') : null,
  ]
    .filter(Boolean)
    .join('，');

  return (
    <View
      style={[
        routeStyles.card,
        styles.card,
        { borderColor: selected ? ROUTE_ACCENT_COLOR : ROUTE_BORDER_COLOR, backgroundColor: colors.background },
        selected && styles.cardSelected,
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11ySummary}
        accessibilityState={{ selected }}
        onPress={onSelect}
        style={styles.summary}>
        <Text style={[styles.duration, { color: colors.text }]}>{duration}</Text>
        {/* 運具串：步行 › 🚌 28 › 步行（連續步行合併，大眾運輸帶路線號） */}
        <View style={styles.legChain} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {chain.map((segment, index) => (
            <View key={`${segment.type}-${index}`} style={styles.legChainItem}>
              {index > 0 ? <Icon name="chevronRight" size={14} color={colors.textSecondary} /> : null}
              {segment.label ? (
                <View style={[styles.legPill, { backgroundColor: LEG_LABEL_FILL[segment.type] }]}>
                  <Icon name={LEG_ICON[segment.type]} size={13} color="#FFFFFF" />
                  <Text style={styles.legPillText} numberOfLines={1}>
                    {segment.label}
                  </Text>
                </View>
              ) : (
                <Icon name={LEG_ICON[segment.type]} size={18} color={colors.textSecondary} />
              )}
            </View>
          ))}
        </View>
        {summary && summary !== route.routeName && chain.every((segment) => !segment.label) ? (
          <Text style={[routeStyles.metaText, { color: colors.textSecondary }]} numberOfLines={2}>
            {summary}
          </Text>
        ) : null}
        <View style={routeStyles.chipsRow}>
          {starText && stars !== null ? (
            <View style={[routeStyles.badge, { backgroundColor: ROUTE_SURFACE_COLOR }]}>
              <Icon name="star" size={12} color={tones[STAR_TONE[stars] ?? 'warn']} />
              <Text style={[routeStyles.badgeText, { color: tones[STAR_TONE[stars] ?? 'warn'] }]}>{starText}</Text>
            </View>
          ) : null}
          {alerts > 0 ? (
            <View style={[routeStyles.badge, { backgroundColor: ROUTE_WARN_SURFACE }]}>
              <Icon name="alert" size={12} color={tones.warn} />
              <Text style={[routeStyles.badgeText, { color: tones.warn }]}>{t('routeTransitAlertsBadge', { count: alerts })}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      {selected ? (
        <View style={styles.expanded}>
          {facts.length > 0 ? (
            <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>{facts.join(' · ')}</Text>
          ) : null}
          {/* 亮點改成安靜的勾選清單：以前是一整片綠色 chip，重要的警告反而淹沒在裡面 */}
          {highlights.length > 0 ? (
            <View style={styles.highlights}>
              {highlights.map((highlight) => {
                const caution = isCaution(highlight);
                return (
                  <View key={highlight} style={styles.highlightRow}>
                    <Icon name={caution ? 'alert' : 'check'} size={14} color={caution ? tones.warn : tones.ok} />
                    <Text style={[routeStyles.metaText, routeStyles.flex, { color: colors.text }]}>{highlight}</Text>
                  </View>
                );
              })}
              {hiddenHighlights > 0 ? (
                <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>
                  {t('nativeMoreHighlights', { count: hiddenHighlights })}
                </Text>
              ) : null}
            </View>
          ) : null}
          {route.warnings?.length ? (
            <View style={[styles.warningCard, { backgroundColor: route.degraded === true ? ROUTE_DANGER_SURFACE : ROUTE_WARN_SURFACE }]}>
              <Icon name="alert" size={16} color={route.degraded === true ? tones.danger : tones.warn} />
              <View style={routeStyles.flex}>
                {route.warnings.map((warning) => (
                  <Text key={warning} style={[routeStyles.metaText, { color: colors.text }]}>
                    {warning}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('nativeRouteDetails')}
            onPress={onOpenDetail}
            style={[routeStyles.listRow, styles.detailRow, { borderColor: ROUTE_BORDER_COLOR }]}>
            <Icon name="list" size={16} color={tones.accent} />
            <Text style={[routeStyles.bodyText, routeStyles.flex, { color: tones.accent }]}>{t('nativeRouteDetails')}</Text>
            <Icon name="chevronRight" size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.card, padding: 14 },
  cardSelected: { borderWidth: 2 },
  summary: { gap: 8 },
  duration: { fontSize: TYPE.headline + 2, fontWeight: '700' },
  legChain: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 6 },
  legChainItem: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 4 },
  // minHeight 而非固定高度：字級放大時膠囊跟著長高，不截字
  legPill: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 24, paddingVertical: 2, borderRadius: 6, paddingHorizontal: 7, maxWidth: 140 },
  legPillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  expanded: { gap: 10, marginTop: 4 },
  highlights: { gap: 6 },
  highlightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  warningCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: RADIUS.small, padding: 10 },
  detailRow: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0 },
});
