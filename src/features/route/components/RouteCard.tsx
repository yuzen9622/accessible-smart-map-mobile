import { Text } from '@/shared/ui/typography/Text';
import { useRouteSessionStore } from '../store/routeSessionStore';
import { canNavigateRoute } from '../controller/routeSessionPort';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { formatDistance } from '@/shared/geo';
import { getAppLanguage, useAppTranslation } from '@/shared/i18n';
import { RADIUS, TYPE, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import {
  effectiveAccessibilityScore,
  getConfidenceLabelKey,
  getRouteAlertsCount,
  legChainSegments,
  legTimelineSegments,
  routeFacts,
  routeSummary,
  type Translate,
} from '../domain/routeCard';
import { LEG_ICON, LEG_LABEL_FILL, scoreToStars } from '../domain/routeDisplay';
import { presentRouteNames } from '../domain/routeNames';
import { orderRouteHighlights } from '../domain/routeMessages';
import type { AccessibleRoute } from '../types/route';
import {
  ROUTE_ACCENT_COLOR,
  ROUTE_BORDER_COLOR,
  ROUTE_ON_ACCENT_COLOR,
  ROUTE_DANGER_SURFACE,
  ROUTE_SURFACE_COLOR,
  ROUTE_WARN_SURFACE,
  routeStyles,
  routeTones,
} from './palette';
import RouteLegTimeline from './RouteLegTimeline';

export interface RouteCardProps {
  route: AccessibleRoute;
  selected: boolean;
  onSelect: () => void;
  onOpenDetail: () => void;
  /** 選中卡內的「開始導航」（由 app 路由注入 navigation feature）。 */
  onStartNavigation: () => void;
}

const STAR_TONE: Record<number, 'ok' | 'warn' | 'danger'> = { 5: 'ok', 4: 'ok', 3: 'warn', 2: 'warn', 1: 'danger' };
/** 選中時最多列出幾條無障礙亮點；其餘收成「還有 N 項」，完整清單在路線詳情。 */
const MAX_HIGHLIGHTS = 3;

/**
 * 路線卡（Web `RouteCard.tsx`）：總時間、運具串、星等；選中時展開轉乘、步行距離、資料可信度、
 * 無障礙亮點與警告，並提供「路線詳情」入口。整張卡一個 `accessibilityLabel` 念出完整摘要（SDD §4.5）。
 */
export default function RouteCard({ route, selected, onSelect, onOpenDetail, onStartNavigation }: RouteCardProps) {
  const colors = useThemeColors();
  const tones = routeTones(useColorScheme() === 'dark');
  const { t } = useAppTranslation();
  useRouteSessionStore((state) => state.invalidRouteTokens);
  // hazardAdvisory 缺漏＝後端沒有完整比對結果，不是「沒有危險」；只在後端明確列出時才顯示。
  const advisory = route.hazardAdvisory;
  const hazardBlocking = (advisory?.blockingOnRoute ?? 0) > 0;
  const hazardLines: string[] = [];
  if (advisory?.onRoute.length) {
    hazardLines.push(t('nativeRouteHazardsOnRoute', { count: advisory.onRoute.length }));
    if (hazardBlocking) hazardLines.push(t('nativeRouteHazardsBlocking', { count: advisory.blockingOnRoute }));
  }
  if (advisory?.avoided.length) hazardLines.push(t('nativeRouteHazardsAvoided', { count: advisory.avoided.length }));
  const translate = t as Translate;

  const totalMinutes = Math.round(route.totalMinutes);
  const duration =
    totalMinutes >= 60
      ? t('nativeRouteHoursMinutes', { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 })
      : t('nativeRouteMinutes', { count: totalMinutes });
  const detail = routeFacts(route);
  const presentation = presentRouteNames(route, getAppLanguage());
  const summary = routeSummary(presentation.legs, translate);
  const alerts = getRouteAlertsCount(route);
  const score = effectiveAccessibilityScore(route);
  const stars = score === null ? null : scoreToStars(score);
  const starText = stars === null ? null : t(`starLabel${stars}`);
  const confidenceKey = getConfidenceLabelKey(route.dataConfidence);
  const chain = legChainSegments(presentation.legs);
  const timeline = legTimelineSegments(presentation.legs);
  // 先依原始 index 配對，再排序整組；未知／舊字串不推定為成功。
  const ordered = orderRouteHighlights(route.accessibilityHighlights, route.accessibilityHighlightDetails);
  const highlights = ordered.slice(0, MAX_HIGHLIGHTS);
  const hiddenHighlights = route.accessibilityHighlights.length - highlights.length;
  // 只列資料真的有的事實：階梯／坡度後端沒給就不顯示（不能當成 0）
  const facts = [
    route.totalWalkDistanceM != null ? t('nativeRouteFactWalk', { distance: formatDistance(route.totalWalkDistanceM) }) : null,
    detail.stairs !== null ? t('nativeRouteFactStairs', { count: detail.stairs }) : null,
    detail.maxSlopePercent !== null ? t('nativeRouteFactSlope', { value: Math.round(detail.maxSlopePercent * 10) / 10 }) : null,
    route.transferCount > 0 ? t('transferCount', { count: route.transferCount }) : null,
    confidenceKey ? `${t('dataConfidence')}：${t(confidenceKey)}` : null,
  ].filter(Boolean);
  const a11ySummary = [
    route.routeName,
    duration,
    summary,
    selected ? facts.join('，') : null,
    starText,
    alerts > 0 ? t('routeTransitAlertsBadge', { count: alerts }) : null,
    selected ? t('selectedRoute') : null,
  ]
    .filter(Boolean)
    .join('，');

  return (
    <View
      style={[
        styles.card,
        { borderColor: selected ? ROUTE_ACCENT_COLOR : ROUTE_BORDER_COLOR, backgroundColor: colors.background },
        selected && styles.cardSelected,
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11ySummary}
        accessibilityHint={selected ? undefined : t('nativeRouteSelectHint')}
        accessibilityState={{ selected }}
        onPress={onSelect}
        style={styles.summary}>
        {selected ? (
          <>
            <View style={styles.titleRow}>
              <Text style={[styles.duration, { color: colors.text }]} maxFontSizeMultiplier={1.6}>
                {duration}
              </Text>
              {/* 運具串：步行 › 🚌 28 › 步行（連續步行合併，大眾運輸帶路線號） */}
              <View style={styles.legChain} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                {chain.map((segment, index) => (
                  <View key={`${segment.type}-${index}`} style={styles.legChainItem}>
                    {index > 0 ? <Icon name="chevronRight" size={14} color={colors.textSecondary} /> : null}
                    {segment.label ? (
                      <View style={[styles.legPill, { backgroundColor: LEG_LABEL_FILL[segment.type] }]}>
                        <Icon name={LEG_ICON[segment.type]} size={13} color="#FFFFFF" />
                        <Text style={styles.legPillText} numberOfLines={1} maxFontSizeMultiplier={1.6}>
                          {segment.label}
                        </Text>
                      </View>
                    ) : (
                      <Icon name={LEG_ICON[segment.type]} size={18} color={colors.textSecondary} />
                    )}
                  </View>
                ))}
              </View>
            </View>
            {facts.length > 0 ? (
              <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>{facts.join(' · ')}</Text>
            ) : null}
            <RouteLegTimeline segments={timeline} />
            <View style={routeStyles.chipsRow}>
              {starText && stars !== null ? (
                <View style={[routeStyles.badge, { backgroundColor: ROUTE_SURFACE_COLOR }]}>
                  <Icon name="star" size={12} color={tones[STAR_TONE[stars] ?? 'warn']} />
                  <Text style={[routeStyles.badgeText, { color: tones[STAR_TONE[stars] ?? 'warn'] }]}>{starText}</Text>
                </View>
              ) : null}
              {detail.elevators > 0 ? (
                <View style={[routeStyles.badge, { backgroundColor: ROUTE_SURFACE_COLOR }]}>
                  <Text style={[routeStyles.badgeText, { color: colors.textSecondary }]}>
                    {t('nativeRouteChipElevators', { count: detail.elevators })}
                  </Text>
                </View>
              ) : null}
              {alerts > 0 ? (
                <View style={[routeStyles.badge, { backgroundColor: ROUTE_WARN_SURFACE }]}>
                  <Icon name="alert" size={12} color={tones.warn} />
                  <Text style={[routeStyles.badgeText, { color: tones.warn }]}>{t('routeTransitAlertsBadge', { count: alerts })}</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <View style={styles.titleRow}>
              <View style={routeStyles.flex}>
                <Text style={[styles.durationSmall, { color: colors.text }]} maxFontSizeMultiplier={1.6}>
                  {duration}
                </Text>
                <Text style={[routeStyles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {[summary || null, facts[0] ?? null, starText].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {/* 路線號已經在下面的時間軸裡，這裡只留 chevron 提示點了會看明細（原本在此重複顯示
                  一次路線號膠囊，使用者回饋 2026-10-23：規劃結果希望跟選中的卡片一樣看得到時間軸）。 */}
              <Icon name="chevronRight" size={18} color={colors.textSecondary} />
            </View>
            <RouteLegTimeline segments={timeline} />
          </>
        )}
      </Pressable>

      {selected ? (
        <View style={styles.expanded}>
          {/* 亮點改成安靜的勾選清單：以前是一整片綠色 chip，重要的警告反而淹沒在裡面 */}
          {highlights.length > 0 ? (
            <View style={styles.highlights}>
              {highlights.map((highlight) => {
                const caution = highlight.tone === 'caution';
                const positive = highlight.tone === 'positive';
                return (
                  <View key={highlight.index} style={styles.highlightRow}>
                    <Icon name={caution ? 'alert' : positive ? 'check' : 'info'} size={14} color={caution ? tones.warn : positive ? tones.ok : colors.textSecondary} />
                    <Text style={[routeStyles.metaText, routeStyles.flex, { color: colors.text }]}>{highlight.text}</Text>
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
                {route.warnings.map((warning, index) => (
                  <Text key={index} style={[routeStyles.metaText, { color: colors.text }]}>
                    {warning}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}
          {hazardLines.length ? (
            <View style={[styles.warningCard, { backgroundColor: hazardBlocking ? ROUTE_DANGER_SURFACE : ROUTE_WARN_SURFACE }]}>
              <Icon name="alert" size={16} color={hazardBlocking ? tones.danger : tones.warn} />
              <View style={routeStyles.flex}>
                {hazardLines.map((line) => (
                  <Text key={line} style={[routeStyles.metaText, { color: colors.text }]}>
                    {line}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}
          {!canNavigateRoute(route) ? <Text accessibilityLiveRegion="polite" style={{ color: tones.warn }}>{t('nativeRouteTokenUnavailable')}</Text> : null}
          {route.legs.some((leg) => !leg.polyline?.length) ? <Text style={{ color: colors.textSecondary }}>{t('nativeRouteGeometryMissing')}</Text> : null}
          {/* 「路線詳情」跟「開始導航」並排兩顆等寬按鈕，不是一顆主按鈕＋下面一整排連結
              （使用者回饋 2026-10-23，參考設計圖二：兩個動作同樣重要，不要分主次）。 */}
          <View style={styles.actionsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('nativeRouteDetails')}
              onPress={onOpenDetail}
              style={[styles.detailButton, { borderColor: ROUTE_BORDER_COLOR }]}>
              <Icon name="list" size={16} color={tones.accent} />
              <Text style={[routeStyles.bodyText, { color: tones.accent }]}>{t('nativeRouteDetails')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('startNav')}
              disabled={!canNavigateRoute(route)}
              accessibilityState={{ disabled: !canNavigateRoute(route) }}
              onPress={onStartNavigation}
              style={[routeStyles.primaryButton, styles.actionsRowButton]}>
              <Icon name="navigation" color={ROUTE_ON_ACCENT_COLOR} />
              <Text style={routeStyles.primaryButtonText}>{t('startNav')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.card, padding: 14, gap: 8 },
  cardSelected: { borderWidth: 2 },
  summary: { gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  duration: { fontSize: TYPE.title, fontWeight: '700' },
  durationSmall: { fontSize: TYPE.headline, fontWeight: '700' },
  legChain: { flexShrink: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', rowGap: 6 },
  legChainItem: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 4 },
  // minHeight 而非固定高度：字級放大時膠囊跟著長高，不截字
  legPill: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 24, paddingVertical: 2, borderRadius: 6, paddingHorizontal: 7, maxWidth: 140 },
  legPillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  expanded: { gap: 10, marginTop: 4 },
  highlights: { gap: 6 },
  highlightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  warningCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: RADIUS.small, padding: 10 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  actionsRowButton: { flex: 1 },
  detailButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
