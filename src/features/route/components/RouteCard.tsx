import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { formatDistance } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';
import { useThemeColors } from '@/shared/theme';
import { Icon, type IconName } from '@/shared/ui';

import {
  effectiveAccessibilityScore,
  getConfidenceLabelKey,
  getRouteAlertsCount,
  routeSummary,
  type Translate,
} from '../domain/routeCard';
import { formatDuration, getLegColor, scoreToStars } from '../domain/routeDisplay';
import type { AccessibleRoute, RouteLeg } from '../types/route';
import { ROUTE_ACCENT_COLOR, ROUTE_BORDER_COLOR, ROUTE_SURFACE_COLOR, ROUTE_WARN_SURFACE, routeStyles, routeTones } from './palette';

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
        <View style={routeStyles.row}>
          <Text style={[styles.duration, { color: colors.text }]}>{duration}</Text>
          <View style={styles.legChain}>
            {route.legs.map((leg, index) => (
              <View key={`${leg.type}-${index}`} style={[styles.legDot, { backgroundColor: getLegColor(leg) }]}>
                <Icon name={LEG_ICON[leg.type]} size={14} color="#FFFFFF" />
              </View>
            ))}
          </View>
        </View>
        <Text style={[routeStyles.bodyText, { color: colors.text }]} numberOfLines={1}>
          {route.routeName}
        </Text>
        {summary && summary !== route.routeName ? (
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
          <View style={routeStyles.chipsRow}>
            {route.transferCount > 0 ? (
              <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>{t('transferCount', { count: route.transferCount })}</Text>
            ) : null}
            {route.totalWalkDistanceM != null ? (
              <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>
                {t('totalWalkDistance', { distance: formatDistance(route.totalWalkDistanceM) })}
              </Text>
            ) : null}
            {confidenceKey ? (
              <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>
                {`${t('dataConfidence')}：${t(confidenceKey)}`}
              </Text>
            ) : null}
          </View>
          {route.accessibilityHighlights.length > 0 ? (
            <View style={routeStyles.chipsRow}>
              {route.accessibilityHighlights.map((highlight) => {
                const caution = highlight.includes('請留意') || highlight.includes('無法');
                return (
                  <View key={highlight} style={[routeStyles.badge, { backgroundColor: caution ? ROUTE_WARN_SURFACE : ROUTE_SURFACE_COLOR }]}>
                    <Icon name={caution ? 'alert' : 'check'} size={12} color={caution ? tones.warn : tones.ok} />
                    <Text style={[routeStyles.badgeText, { color: caution ? tones.warn : tones.ok }]}>{highlight}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
          {route.warnings?.map((warning) => (
            <Text key={warning} style={[routeStyles.metaText, { color: route.degraded === true ? tones.danger : tones.warn }]}>
              {warning}
            </Text>
          ))}
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
  card: { borderWidth: StyleSheet.hairlineWidth },
  cardSelected: { borderWidth: 2 },
  summary: { gap: 6 },
  duration: { fontSize: 20, fontWeight: '700' },
  legChain: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1, justifyContent: 'flex-end' },
  legDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  expanded: { gap: 8 },
  detailRow: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0 },
});
