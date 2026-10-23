import { Text } from '@/shared/ui/typography/Text';
import { canNavigateRoute } from '../controller/routeSessionPort';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { useSemanticColors, useThemeColors } from '@/shared/theme';
import { EmptyState, Icon } from '@/shared/ui';

import LegDetail from '../components/LegDetail';
import RouteSafetyNotice from '../components/RouteSafetyNotice';
import { ROUTE_DESTINATION_COLOR } from '../domain/routeLayerData';
import { ROUTE_BORDER_COLOR, ROUTE_ON_ACCENT_COLOR, routeStyles } from '../components/palette';
import { computeLegClock, nowClockMinutes } from '../domain/legClock';
import { formatDuration } from '../domain/routeDisplay';
import { useRouteSessionStore } from '../store/routeSessionStore';
import type { AccessibleRoute, BusLeg } from '../types/route';

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
 * `(sheet)/routes/[index]` — 路線明細：每段 leg 一張卡（SDD §4.5），底部「開始導航」。
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
  // 時間軸從使用者規劃時選的出發時間起算，沒選就當作現在出發（使用者回饋 2026-10-23，參考設計圖三：
  // 每個步驟旁邊要有實際時鐘時間，不是只有相對分鐘數）。
  const startMinutes = preferredDeparture ? nowClockMinutes(new Date(preferredDeparture)) : nowClockMinutes();
  const legClock = route ? computeLegClock(route.legs, startMinutes) : [];
  const finalArrival = legClock.at(-1)?.arrivalLabel ?? null;

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
          {!canNavigateRoute(route) ? <Text style={{ color: colors.textSecondary }}>{t('nativeRouteTokenUnavailable')}</Text> : null}
          <RouteSafetyNotice />
          {renderExplanation ? renderExplanation(route) : null}
          <Text accessibilityRole="header" style={[routeStyles.sectionTitle, { color: colors.text }]}>
            {route.routeName}
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
                <LegDetail
                  leg={leg}
                  engine={route.engine}
                  isFirst={legIndex === 0}
                  isLast={legIndex === route.legs.length - 1}
                  busStops={leg.type === 'BUS' && renderBusLeg ? renderBusLeg({ route, routeIndex, legIndex, leg }) : undefined}
                />
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
                  <Icon name="flag" size={12} color="#FFFFFF" />
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
          {/* Full original arrays, including items collapsed in RouteCard and legacy/source warnings. */}
          {[route.accessibilityHighlights, route.warnings ?? [], route.scoreWarnings ?? []].map((messages, group) => (
            <View key={group}>
              {messages.map((message, index) => (
                <Text key={index} style={[routeStyles.metaText, { color: colors.textSecondary }]}>
                  {message}
                </Text>
              ))}
            </View>
          ))}
          {route.attribution ? (
            <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>{route.attribution}</Text>
          ) : null}
          {/* 「開始導航」收尾放在整條時間軸之後，不是畫面一開始就先要你按（使用者回饋 2026-10-23，
              參考設計圖三：看完完整路線再決定要不要出發）。 */}
          <Pressable disabled={!canNavigateRoute(route)} accessibilityState={{ disabled: !canNavigateRoute(route) }} accessibilityRole="button" accessibilityLabel={t('startNav')} onPress={onStartNavigation} style={routeStyles.primaryButton}>
            <Icon name="navigation" color={ROUTE_ON_ACCENT_COLOR} />
            <Text style={routeStyles.primaryButtonText}>{t('startNav')}</Text>
          </Pressable>
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  timelineRow: { flexDirection: 'row', gap: 10 },
  // 固定寬度讓時鐘時間跟連接線對齊，不管文字多寬（"HH:mm" 都是 5 碼，但大字級要留餘裕）
  timelineRail: { width: 44, alignItems: 'center', gap: 2 },
  clockLabel: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  // flex:1 讓連接線補滿這個 leg 卡片的高度，貼到下一個時鐘時間
  timelineLine: { flex: 1, width: 2, borderRadius: 1, minHeight: 12 },
  destinationRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  destinationDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
