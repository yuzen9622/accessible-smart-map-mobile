import { Text } from '@/shared/ui/typography/Text';
import { useRouteSessionStore } from '../store/routeSessionStore';
import { canNavigateRoute } from '../controller/routeSessionPort';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { formatDistance } from '@/shared/geo';
import { getAppLanguage, useAppTranslation } from '@/shared/i18n';
import { MAX_FONT_SCALE, TYPE, useSemanticColors, useThemeColors, WHITE, SHAPE, ICON_SIZE } from '@/shared/theme';
import { useNow } from '@/shared/time';
import { Icon } from '@/shared/ui';

import { formatRouteClock, routeDayOffset } from '../domain/departureCandidates';
import {
  effectiveAccessibilityScore,
  firstBoarding,
  getConfidenceLabelKey,
  getRouteAlertsCount,
  legChainSegments,
  legTimelineSegments,
  localizedDuration,
  routeFacts,
  routeSummary,
  type FirstBoarding,
  type Translate,
} from '../domain/routeCard';
import { LEG_ICON, LEG_LABEL_FILL, scoreToStars } from '../domain/routeDisplay';
import { presentRouteNames } from '../domain/routeNames';
import { orderRouteHighlights } from '../domain/routeMessages';
import type { AccessibleRoute } from '../types/route';
import {
  ROUTE_ON_ACCENT_COLOR,
  ROUTE_DANGER_SURFACE,
  ROUTE_WARN_SURFACE,
  routeStyles,
  routeTones,
} from './palette';
import RouteLegTimeline from './RouteLegTimeline';
import PressableScale from '@/shared/ui/PressableScale';
import { Numeral } from '@/shared/ui/typography/Numeral';

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
 * 路線卡（Web `RouteCard.tsx`，版面參考 Google Maps／Apple 地圖的大眾運輸結果）：
 * 第一列總時間＋出發到抵達時刻，第二列運具串（公車附「+N」＝同站也能搭的其他路線），
 * 第三列「幾分後於 X 上車」（即時綠字／時刻表灰字），最後是無障礙星等與事實。
 * 選中時展開亮點與警告，底部並排「開始導航」與「詳細資訊」。整張卡一個 `accessibilityLabel` 念出完整摘要（SDD §4.5）。
 */
export default function RouteCard({ route, selected, onSelect, onOpenDetail, onStartNavigation }: RouteCardProps) {
  const colors = useThemeColors();
  const semantic = useSemanticColors();
  const tones = routeTones(useColorScheme() === 'dark');
  const { t } = useAppTranslation();
  const now = useNow(30_000);
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

  const duration = localizedDuration(route.totalMinutes, translate);
  const departClock = formatRouteClock(route.departureTime);
  const arriveClock = formatRouteClock(route.arrivalTime);
  const dayOffset = routeDayOffset(route.arrivalTime, route.departureTime);
  const arriveText = arriveClock && dayOffset ? `${arriveClock} ${t('nativeRouteDayOffset', { days: dayOffset })}` : arriveClock;
  const journey = departClock && arriveText ? `${departClock} → ${arriveText}` : null;
  const detail = routeFacts(route);
  const presentation = presentRouteNames(route, getAppLanguage());
  const summary = routeSummary(presentation.legs, translate);
  const boarding = firstBoarding(presentation.legs, now);
  const boardingText = boarding ? boardingLine(boarding, t) : null;
  const alerts = getRouteAlertsCount(route);
  const score = effectiveAccessibilityScore(route);
  const stars = score === null ? null : scoreToStars(score);
  const starText = stars === null ? null : t(`starLabel${stars}`);
  const confidenceKey = getConfidenceLabelKey(route.dataConfidence);
  const chain = legChainSegments(presentation.legs, translate);
  const timeline = legTimelineSegments(presentation.legs, translate);
  const alternatives = [...new Set(chain.flatMap((segment) => segment.alternatives ?? []))];
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
  const canNavigate = canNavigateRoute(route);

  // 不用後端的 route.routeName（中文串接字），讀屏以 legs 本地化的 summary 為準。
  const a11ySummary = [
    duration,
    departClock && arriveText ? t('nativeRouteJourneyA11y', { from: departClock, to: arriveText }) : null,
    summary,
    alternatives.length ? t('nativeBusAlsoRoutes', { routes: alternatives.join('、') }) : null,
    boardingText?.text,
    selected ? facts.join('，') : facts[0],
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
        { backgroundColor: semantic.surface, borderColor: selected ? semantic.accent : 'transparent' },
      ]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={a11ySummary}
        accessibilityHint={selected ? undefined : t('nativeRouteSelectHint')}
        accessibilityState={{ selected }}
        onPress={onSelect}
        style={styles.summary}>
        <View style={styles.titleRow}>
          <Text style={[styles.duration, { color: colors.text }]} maxFontSizeMultiplier={MAX_FONT_SCALE.heading}>
            {duration}
          </Text>
          {journey ? (
            <Numeral style={[styles.journey, { color: colors.textSecondary }]} maxFontSizeMultiplier={MAX_FONT_SCALE.label}>
              {journey}
            </Numeral>
          ) : null}
        </View>

        {/* 運具串：步行 › 🚌 5 +4 › 步行（連續步行合併，大眾運輸帶路線號；+N＝同站也能搭的其他路線） */}
        {chain.some((segment) => segment.type !== 'WALK') ? (
          <View style={styles.legChain} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {chain.map((segment, index) => (
              <View key={`${segment.type}-${index}`} style={styles.legChainItem}>
                {index > 0 ? <Icon name="chevronRight" size={ICON_SIZE.caption} color={colors.textSecondary} /> : null}
                {segment.label ? (
                  <View style={[styles.legPill, { backgroundColor: LEG_LABEL_FILL[segment.type] }]}>
                    <Icon name={LEG_ICON[segment.type]} size={ICON_SIZE.caption} color={WHITE} />
                    <Text style={styles.legPillText} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE.label}>
                      {segment.label}
                    </Text>
                  </View>
                ) : (
                  <Icon name={LEG_ICON[segment.type]} size={ICON_SIZE.body} color={colors.textSecondary} />
                )}
                {segment.alternatives?.length ? (
                  <View style={[styles.altBadge, { borderColor: semantic.separator }]}>
                    <Text style={[styles.altBadgeText, { color: colors.textSecondary }]} maxFontSizeMultiplier={MAX_FONT_SCALE.label}>
                      {`+${segment.alternatives.length}`}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {boardingText ? (
          <View style={styles.boardingRow}>
            <Icon name={boardingText.live ? 'live' : 'clock'} size={ICON_SIZE.caption} color={boardingText.live ? semantic.ok.fg : colors.textSecondary} />
            <Text
              style={[styles.boardingText, { color: boardingText.live ? semantic.ok.fg : colors.textSecondary }]}
              numberOfLines={selected ? 2 : 1}>
              {boardingText.text}
            </Text>
          </View>
        ) : null}

        {selected ? (
          <>
            {facts.length > 0 ? (
              <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>{facts.join(' · ')}</Text>
            ) : null}
            {alternatives.length ? (
              <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>
                {t('nativeBusAlsoRoutes', { routes: alternatives.join('、') })}
              </Text>
            ) : null}
            <RouteLegTimeline segments={timeline} />
            <View style={routeStyles.chipsRow}>
              {starText && stars !== null ? (
                <View style={[routeStyles.badge, { backgroundColor: colors.background }]}>
                  <Icon name="star" size={ICON_SIZE.caption} color={tones[STAR_TONE[stars] ?? 'warn']} />
                  <Text style={[routeStyles.badgeText, { color: tones[STAR_TONE[stars] ?? 'warn'] }]}>{starText}</Text>
                </View>
              ) : null}
              {detail.elevators > 0 ? (
                <View style={[routeStyles.badge, { backgroundColor: colors.background }]}>
                  <Text style={[routeStyles.badgeText, { color: colors.textSecondary }]}>
                    {t('nativeRouteChipElevators', { count: detail.elevators })}
                  </Text>
                </View>
              ) : null}
              {alerts > 0 ? (
                <View style={[routeStyles.badge, { backgroundColor: ROUTE_WARN_SURFACE }]}>
                  <Icon name="alert" size={ICON_SIZE.caption} color={tones.warn} />
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
              <Icon name="chevronRight" size={ICON_SIZE.body} color={colors.textSecondary} />
            </View>
            <RouteLegTimeline segments={timeline} />
          </>
        )}
      </PressableScale>

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
                    <Icon name={caution ? 'alert' : positive ? 'check' : 'info'} size={ICON_SIZE.caption} color={caution ? tones.warn : positive ? tones.ok : colors.textSecondary} />
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
              <Icon name="alert" size={ICON_SIZE.body} color={route.degraded === true ? tones.danger : tones.warn} />
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
              <Icon name="alert" size={ICON_SIZE.body} color={hazardBlocking ? tones.danger : tones.warn} />
              <View style={routeStyles.flex}>
                {hazardLines.map((line) => (
                  <Text key={line} style={[routeStyles.metaText, { color: colors.text }]}>
                    {line}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}
          {!canNavigate ? <Text accessibilityLiveRegion="polite" style={{ color: tones.warn }}>{t('nativeRouteTokenUnavailable')}</Text> : null}
          {route.legs.some((leg) => !leg.polyline?.length) ? <Text style={{ color: colors.textSecondary }}>{t('nativeRouteGeometryMissing')}</Text> : null}
          <View style={styles.actions}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('startNav')}
              disabled={!canNavigate}
              accessibilityState={{ disabled: !canNavigate }}
              onPress={onStartNavigation}
              style={[routeStyles.primaryButton, styles.primaryAction, !canNavigate && routeStyles.disabled]}>
              <Icon name="navigation" color={ROUTE_ON_ACCENT_COLOR} />
              <Text style={routeStyles.primaryButtonText} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE.label}>
                {t('startNav')}
              </Text>
            </PressableScale>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('nativeRouteDetails')}
              onPress={onOpenDetail}
              style={[styles.secondaryAction, { backgroundColor: semantic.accentSoft }]}>
              <Icon name="list" size={ICON_SIZE.body} color={semantic.accent} />
              <Text style={[styles.secondaryActionText, { color: semantic.accent }]} numberOfLines={1} maxFontSizeMultiplier={MAX_FONT_SCALE.label}>
                {t('nativeRouteDetailsShort')}
              </Text>
            </PressableScale>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** 「幾分後於 X 上車」：即時（綠字＋訊號圖示）、時刻表（灰字＋時鐘）；沒有時刻就不顯示這行。 */
function boardingLine(boarding: FirstBoarding, t: (key: string, options?: Record<string, unknown>) => string): { text: string; live: boolean } | null {
  const { departure, stop } = boarding;
  if (departure.kind === 'live') {
    return departure.minutes <= 1
      ? { text: t('nativeRouteBoardArriving', { stop }), live: true }
      : { text: t('nativeRouteBoardLive', { count: departure.minutes, stop }), live: true };
  }
  if (departure.kind === 'scheduled') return { text: t('nativeRouteBoardScheduled', { time: departure.clock, stop }), live: false };
  return null;
}

const styles = StyleSheet.create({
  // 選中與未選中同樣 2pt 外框（未選中是透明），切換時卡片不會跳動
  card: { borderWidth: 2, borderRadius: SHAPE.card, borderCurve: 'continuous', padding: 14, gap: 10 },
  summary: { gap: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: 8 },
  duration: { fontSize: TYPE.title1, fontWeight: '700' },
  durationSmall: { fontSize: TYPE.title3, fontWeight: '700' },
  journey: { fontSize: TYPE.subhead, fontWeight: '600' },
  legChain: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 6 },
  legChainItem: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 4 },
  // minHeight 而非固定高度：字級放大時膠囊跟著長高，不截字
  legPill: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 24, paddingVertical: 2, borderRadius: SHAPE.badge, borderCurve: 'continuous', paddingHorizontal: 7, maxWidth: 140 },
  legPillText: { color: WHITE, fontSize: TYPE.footnote, fontWeight: '700' },
  altBadge: { borderWidth: StyleSheet.hairlineWidth, borderRadius: SHAPE.badge, borderCurve: 'continuous', paddingHorizontal: 5, minHeight: 20, justifyContent: 'center' },
  altBadgeText: { fontSize: TYPE.caption, fontWeight: '600', fontVariant: ['tabular-nums'] },
  boardingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  boardingText: { flex: 1, fontSize: TYPE.footnote + 1, fontWeight: '600' },
  compactMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  expanded: { gap: 10 },
  highlights: { gap: 6 },
  highlightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  warningCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: SHAPE.control, borderCurve: 'continuous', padding: 10 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  primaryAction: { flex: 1 },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 50,
    borderRadius: SHAPE.pill, borderCurve: 'continuous',
    paddingHorizontal: 18,
  },
  secondaryActionText: { fontSize: TYPE.callout, fontWeight: '600' },
});
