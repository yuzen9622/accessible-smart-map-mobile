import { Text } from '@/shared/ui/typography/Text';
import { canNavigateRoute } from '../controller/routeSessionPort';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { formatDistance } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';
import { MAX_FONT_SCALE, TYPE, useSemanticColors, useThemeColors, SHAPE, ICON_SIZE } from '@/shared/theme';
import { EmptyState, Icon } from '@/shared/ui';

import LegDetail from '../components/LegDetail';
import RouteSafetyNotice from '../components/RouteSafetyNotice';
import { ROUTE_ON_ACCENT_COLOR, routeStyles } from '../components/palette';
import { formatRouteClock, routeDayOffset } from '../domain/departureCandidates';
import { effectiveAccessibilityScore, localizedDuration, type Translate } from '../domain/routeCard';
import { scoreToStars } from '../domain/routeDisplay';
import { ROUTE_DESTINATION_COLOR, ROUTE_ORIGIN_COLOR } from '../domain/routeLayerData';
import { useRouteSessionStore } from '../store/routeSessionStore';
import type { AccessibleRoute, BusLeg } from '../types/route';
import PressableScale from '@/shared/ui/PressableScale';

export interface BusLegRenderArgs {
  route: AccessibleRoute;
  routeIndex: number;
  legIndex: number;
  leg: BusLeg;
}

export interface RouteDetailScreenProps {
  onStartNavigation: () => void;
  /** 公車 leg 站點／即時 ETA（bus feature 的 `BusLegStops`），由 app 路由組裝注入。 */
  renderBusLeg?: (args: BusLegRenderArgs) => ReactNode;
  /** 「AI 路線說明」（ai feature 的 `RouteExplanationCard`），由 app 路由組裝注入；route 不 import ai（ai 依賴 route）。 */
  renderExplanation?: (route: AccessibleRoute) => ReactNode;
}

/** 時間軸的起點／終點節點：左側圓點對齊各段的軌道，右側地名與時刻。 */
function TimelineNode({ kind, name, time, label }: { kind: 'start' | 'end'; name: string; time: string | null; label: string }) {
  const colors = useThemeColors();
  const start = kind === 'start';
  return (
    <View accessible accessibilityLabel={[label, name, time].filter(Boolean).join('，')} style={styles.node}>
      <View style={styles.nodeRail}>
        {start ? (
          <View style={[styles.nodeDot, { borderColor: ROUTE_ORIGIN_COLOR, backgroundColor: colors.background }]} />
        ) : (
          <Icon name="mapPin" size={ICON_SIZE.control} color={ROUTE_DESTINATION_COLOR} />
        )}
      </View>
      <View style={styles.nodeTexts}>
        <Text style={[styles.nodeLabel, { color: colors.textSecondary }]} maxFontSizeMultiplier={MAX_FONT_SCALE.label}>
          {label}
        </Text>
        <Text style={[styles.nodeName, { color: colors.text }]} numberOfLines={2}>
          {name}
        </Text>
      </View>
      {time ? (
        <Text style={[styles.nodeTime, { color: colors.text }]} maxFontSizeMultiplier={MAX_FONT_SCALE.label}>
          {time}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * `(sheet)/routes/[index]` — 路線明細，版面參考 Google Maps 的大眾運輸詳情：
 * 摘要（總時間、出發到抵達時刻、步行與轉乘）→「開始導航」→ 安全提醒與 AI 說明 →
 * 垂直時間軸（起點 → 每段 leg → 終點；公車段內可切換查看同站其他班次的即時時刻）→ 完整提示與資料來源。
 * 這頁同時是路線的文字替代路徑（SDD §10）：所有步驟與站點都以可讀文字列出。
 */
export default function RouteDetailScreen({ onStartNavigation, renderBusLeg, renderExplanation }: RouteDetailScreenProps) {
  const { t } = useAppTranslation();
  useRouteSessionStore((state) => state.invalidRouteTokens);
  const colors = useThemeColors();
  const semantic = useSemanticColors();
  const { index } = useLocalSearchParams<{ index: string }>();
  const routeIndex = Number(index);
  const route = useRouteSessionStore((s) => (Number.isInteger(routeIndex) ? (s.computeRoutes?.[routeIndex] ?? null) : null));
  const originName = useRouteSessionStore((s) => s.originName);
  const destinationName = useRouteSessionStore((s) => s.destinationName);

  if (!route) {
    return (
      <>
        <Stack.Screen options={{ title: t('nativeRouteDetails') }} />
        <EmptyState title={t('nativeRouteErrorEmpty')} systemImage="map" />
      </>
    );
  }

  const canNavigate = canNavigateRoute(route);
  const duration = localizedDuration(route.totalMinutes, t as Translate);
  const departClock = formatRouteClock(route.departureTime);
  const arriveClock = formatRouteClock(route.arrivalTime);
  const dayOffset = routeDayOffset(route.arrivalTime, route.departureTime);
  const arriveText = arriveClock && dayOffset ? `${arriveClock} ${t('nativeRouteDayOffset', { days: dayOffset })}` : arriveClock;
  const score = effectiveAccessibilityScore(route);
  const stars = score === null ? null : scoreToStars(score);
  const journeyFacts = [
    route.totalWalkDistanceM != null ? t('nativeRouteFactWalk', { distance: formatDistance(route.totalWalkDistanceM) }) : null,
    route.transferCount > 0 ? t('transferCount', { count: route.transferCount }) : null,
    stars !== null ? t(`starLabel${stars}`) : null,
  ];
  const facts = [departClock && arriveText ? `${departClock} → ${arriveText}` : null, ...journeyFacts].filter(Boolean);
  const notes = [
    ...route.accessibilityHighlights.map((text) => ({ text, warning: false })),
    ...[...(route.warnings ?? []), ...(route.scoreWarnings ?? [])].map((text) => ({ text, warning: true })),
  ];

  return (
    <>
      <Stack.Screen options={{ title: duration }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={routeStyles.content}
        contentInsetAdjustmentBehavior="automatic">
        <View
          accessible
          accessibilityLabel={[duration, departClock && arriveText ? t('nativeRouteJourneyA11y', { from: departClock, to: arriveText }) : null, ...journeyFacts]
            .filter(Boolean)
            .join('，')}
          style={styles.summary}>
          <Text style={[styles.duration, { color: colors.text }]} maxFontSizeMultiplier={MAX_FONT_SCALE.heading}>
            {duration}
          </Text>
          {facts.length > 0 ? (
            <Text style={[styles.facts, { color: colors.textSecondary }]}>{facts.join(' · ')}</Text>
          ) : null}
        </View>
        <PressableScale
          disabled={!canNavigate}
          accessibilityState={{ disabled: !canNavigate }}
          accessibilityRole="button"
          accessibilityLabel={t('startNav')}
          onPress={onStartNavigation}
          style={[routeStyles.primaryButton, !canNavigate && routeStyles.disabled]}>
          <Icon name="navigation" color={ROUTE_ON_ACCENT_COLOR} />
          <Text style={routeStyles.primaryButtonText}>{t('startNav')}</Text>
        </PressableScale>
        {!canNavigate ? <Text style={{ color: colors.textSecondary }}>{t('nativeRouteTokenUnavailable')}</Text> : null}
        <RouteSafetyNotice />
        {renderExplanation ? renderExplanation(route) : null}

        <View style={styles.timeline}>
          <TimelineNode kind="start" label={t('nativeRouteTimelineStart')} name={originName || t('myLocation')} time={departClock} />
          {route.legs.map((leg, legIndex) => (
            <LegDetail
              key={`${leg.type}-${legIndex}`}
              leg={leg}
              engine={route.engine}
              isFirst={legIndex === 0}
              isLast={legIndex === route.legs.length - 1}
              busStops={leg.type === 'BUS' && renderBusLeg ? renderBusLeg({ route, routeIndex, legIndex, leg }) : undefined}
            />
          ))}
          <TimelineNode kind="end" label={t('nativeRouteTimelineEnd')} name={destinationName || t('destination')} time={arriveText} />
        </View>

        {/* Full original arrays, including items collapsed in RouteCard and legacy/source warnings. */}
        {notes.length > 0 || route.attribution ? (
          <View style={[styles.notes, { borderTopColor: semantic.separator }]}>
            {notes.map((note, noteIndex) => (
              <View key={noteIndex} style={styles.noteRow}>
                <Icon name={note.warning ? 'alert' : 'info'} size={ICON_SIZE.caption} color={note.warning ? semantic.warn.fg : colors.textSecondary} />
                <Text style={[routeStyles.metaText, routeStyles.flex, { color: note.warning ? colors.text : colors.textSecondary }]}>{note.text}</Text>
              </View>
            ))}
            {route.attribution ? (
              <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>{route.attribution}</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  summary: { gap: 4 },
  duration: { fontSize: TYPE.title1 + 4, fontWeight: '700' },
  facts: { fontSize: TYPE.subhead, fontVariant: ['tabular-nums'] },
  timeline: { marginTop: 4 },
  node: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingBottom: 12 },
  nodeRail: { width: 32, alignItems: 'center' },
  nodeDot: { width: 18, height: 18, borderRadius: SHAPE.pill, borderCurve: 'continuous', borderWidth: 4 },
  nodeTexts: { flex: 1, gap: 1 },
  nodeLabel: { fontSize: TYPE.caption, fontWeight: '600' },
  nodeName: { fontSize: TYPE.body, fontWeight: '600' },
  nodeTime: { fontSize: TYPE.subhead, fontWeight: '600', fontVariant: ['tabular-nums'] },
  notes: { gap: 8, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
