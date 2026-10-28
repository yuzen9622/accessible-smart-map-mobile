import { Text } from '@/shared/ui/typography/Text';
import { canNavigateRoute } from '../controller/routeSessionPort';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { getAppLanguage, useAppTranslation } from '@/shared/i18n';
import { useSemanticColors, useThemeColors, ICON_SIZE, SHAPE, TYPE, WHITE } from '@/shared/theme';
import { EmptyState, Icon } from '@/shared/ui';

import LegDetail from '../components/LegDetail';
import RouteSafetyNotice from '../components/RouteSafetyNotice';
import { ROUTE_DESTINATION_COLOR } from '../domain/routeLayerData';
import { ROUTE_BORDER_COLOR, ROUTE_ON_ACCENT_COLOR, routeStyles } from '../components/palette';
import { computeLegClock, nowClockMinutes } from '../domain/legClock';
import { formatDuration } from '../domain/routeDisplay';
import { routeSummary, type Translate } from '../domain/routeCard';
import { presentRouteNames } from '../domain/routeNames';
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
  const destinationName = useRouteSessionStore((s) => s.destinationName);
  const preferredDeparture = useRouteSessionStore((s) => s.effectivePreferences?.departureTime);
  const canNavigate = route ? canNavigateRoute(route) : false;
  // 時間軸從使用者規劃時選的出發時間起算，沒選就當作現在出發（使用者回饋 2026-10-23，參考設計圖三：
  // 每個步驟旁邊要有實際時鐘時間，不是只有相對分鐘數）。
  const startMinutes = preferredDeparture ? nowClockMinutes(new Date(preferredDeparture)) : nowClockMinutes();
  const legClock = route ? computeLegClock(route.legs, startMinutes) : [];
  const finalArrival = legClock.at(-1)?.arrivalLabel ?? null;
  const notes = route
    ? [
        ...route.accessibilityHighlights.map((text) => ({ text, warning: false })),
        ...[...(route.warnings ?? []), ...(route.scoreWarnings ?? [])].map((text) => ({ text, warning: true })),
      ]
    : [];

  return (
    <>
      <Stack.Screen options={{ title: route ? formatDuration(route.totalMinutes) : t('nativeRouteDetails') }} />
      {!route ? (
        <EmptyState title={t('nativeRouteErrorEmpty')} systemImage="map" />
      ) : (
        <ScrollView
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={routeStyles.content}
          contentInsetAdjustmentBehavior="automatic">
          {!canNavigate ? <Text style={{ color: colors.textSecondary }}>{t('nativeRouteTokenUnavailable')}</Text> : null}
          <RouteSafetyNotice />
          {renderExplanation ? renderExplanation(route) : null}
          <Text accessibilityRole="header" style={[routeStyles.sectionTitle, { color: colors.text }]}>
            {routeSummary(presentRouteNames(route, getAppLanguage()).legs, t as Translate) || t('walk')}
          </Text>
          {/* 每段左側貼時鐘時間＋連接線，最後接目的地旗標列；大眾運輸 leg 的時間是後端給的真實時刻，
              步行／開車是用估計分鐘數往下推算（`computeLegClock`），不是即時追蹤。 */}
          <View style={routeStyles.section}>
            {route.legs.map((leg, legIndex) => (
              <View key={`${leg.type}-${legIndex}`} style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <Text
                    style={[styles.clockLabel, { color: colors.textSecondary }]}
                    maxFontSizeMultiplier={1.4}
                    accessibilityElementsHidden
                    importantForAccessibility="no">
                    {legClock[legIndex]?.departureLabel}
                  </Text>
                  <View style={[styles.timelineLine, { backgroundColor: ROUTE_BORDER_COLOR }]} />
                </View>
                <View style={styles.timelineContent}>
                  <LegDetail
                    leg={leg}
                    engine={route.engine}
                    isFirst={legIndex === 0}
                    isLast={legIndex === route.legs.length - 1}
                    busStops={leg.type === 'BUS' && renderBusLeg ? renderBusLeg({ route, routeIndex, legIndex, leg }) : undefined}
                  />
                </View>
              </View>
            ))}
            <View style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <Text
                  style={[styles.clockLabel, { color: colors.textSecondary }]}
                  maxFontSizeMultiplier={1.4}
                  accessibilityElementsHidden
                  importantForAccessibility="no">
                  {finalArrival}
                </Text>
              </View>
              <View accessible accessibilityLabel={[destinationName || t('destination'), t('arrived')].join('，')} style={styles.destinationRow}>
                <View style={[styles.destinationDot, { backgroundColor: ROUTE_DESTINATION_COLOR }]}>
                  <Icon name="flag" size={ICON_SIZE.caption} color={WHITE} />
                </View>
                <View style={routeStyles.flex}>
                  <Text style={[routeStyles.bodyText, { color: colors.text }]} numberOfLines={2}>
                    {destinationName || t('destination')}
                  </Text>
                  <Text style={[routeStyles.metaText, { color: semantic.ok.fg }]}>{t('arrived')}</Text>
                </View>
              </View>
            </View>
          </View>
          {/* 亮點與警告合併成一列、各自帶 info／alert 圖示，不是分三段各自列純文字。 */}
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
          {/* 「開始導航」收尾放在整條時間軸之後，不是畫面一開始就先要你按（使用者回饋 2026-10-23，
              參考設計圖三：看完完整路線再決定要不要出發）。 */}
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
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  timelineRow: { flexDirection: 'row', gap: 10 },
  timelineContent: { flex: 1, minWidth: 0 },
  timelineRail: { minWidth: 44, flexShrink: 0, alignItems: 'center', gap: 2 },
  clockLabel: { fontSize: TYPE.caption, fontWeight: '600', fontVariant: ['tabular-nums'] },
  // flex:1 讓連接線補滿這個 leg 卡片的高度，貼到下一個時鐘時間
  timelineLine: { flex: 1, width: 2, borderRadius: SHAPE.pill, borderCurve: 'continuous', minHeight: 12 },
  destinationRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  destinationDot: { width: 24, height: 24, borderRadius: SHAPE.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  notes: { gap: 8, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
});
