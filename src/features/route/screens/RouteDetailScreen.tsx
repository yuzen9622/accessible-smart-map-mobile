import { canNavigateRoute } from '../controller/routeSessionPort';
import { Stack, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { useThemeColors } from '@/shared/theme';
import { EmptyState, Icon } from '@/shared/ui';

import LegDetail from '../components/LegDetail';
import { ROUTE_ON_ACCENT_COLOR, routeStyles } from '../components/palette';
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
  const { index } = useLocalSearchParams<{ index: string }>();
  const routeIndex = Number(index);
  const route = useRouteSessionStore((s) => (Number.isInteger(routeIndex) ? (s.computeRoutes?.[routeIndex] ?? null) : null));

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
          <Pressable disabled={!canNavigateRoute(route)} accessibilityState={{ disabled: !canNavigateRoute(route) }} accessibilityRole="button" accessibilityLabel={t('startNav')} onPress={onStartNavigation} style={routeStyles.primaryButton}>
            <Icon name="navigation" color={ROUTE_ON_ACCENT_COLOR} />
            <Text style={routeStyles.primaryButtonText}>{t('startNav')}</Text>
          </Pressable>
          {!canNavigateRoute(route) ? <Text style={{ color: colors.textSecondary }}>{t('nativeRouteTokenUnavailable')}</Text> : null}
          {renderExplanation ? renderExplanation(route) : null}
          <Text accessibilityRole="header" style={[routeStyles.sectionTitle, { color: colors.text }]}>
            {route.routeName}
          </Text>
          <View style={routeStyles.section}>
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
          </View>
          {route.scoreWarnings?.map((warning) => (
            <Text key={warning} style={[routeStyles.metaText, { color: colors.textSecondary }]}>
              {warning}
            </Text>
          ))}
          {route.attribution ? (
            <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>{route.attribution}</Text>
          ) : null}
        </ScrollView>
      )}
    </>
  );
}
