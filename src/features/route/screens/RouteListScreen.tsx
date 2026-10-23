import { Text } from '@/shared/ui/typography/Text';
import { Stack, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { useThemeColors } from '@/shared/theme';
import { EmptyState, Icon } from '@/shared/ui';

import RouteCard from '../components/RouteCard';
import RouteSafetyNotice from '../components/RouteSafetyNotice';
import { routeStyles, routeTones } from '../components/palette';
import { selectRouteAt } from '../controller/routeSessionPort';
import { useRouteSessionStore } from '../store/routeSessionStore';

export interface RouteListScreenProps {
  /** 由 app 路由組裝注入 navigation feature 的開始導航（route 不 import navigation，避免循環）。 */
  onStartNavigation: () => void;
}

/**
 * `(sheet)/routes` — 路線比較清單（Web `RouteContent.tsx`）。依後端順序列出，預設選中第一條；
 * 點卡片換選中路線並框到它，「路線詳情」進入 leg 明細，選中卡內「開始導航」。
 * 返回（原生返回鍵）回到規劃表單，起訖點保留；Web 返回會清掉結果，這裡保留結果讓 pill 與地圖一致，
 * 下一次按「開始規劃」會整組替換。
 */
export default function RouteListScreen({ onStartNavigation }: RouteListScreenProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const tones = routeTones(useColorScheme() === 'dark');
  const routes = useRouteSessionStore((s) => s.computeRoutes);
  const selected = useRouteSessionStore((s) => s.selectRoute);
  const preferences = useRouteSessionStore((s) => s.effectivePreferences);
  const slope = useRouteSessionStore((s) => s.slopeConstraint);

  return (
    <>
      <Stack.Screen options={{ title: t('routeResultsTitle') }} />
      {!routes || routes.length === 0 ? (
        <EmptyState title={t('nativeRouteErrorEmpty')} systemImage="map" />
      ) : (
        <ScrollView
          style={{ backgroundColor: colors.background }}
          contentContainerStyle={routeStyles.content}
          contentInsetAdjustmentBehavior="automatic">
          {/* 整條寬的「重新規劃」按鈕換成精簡按鈕＋路線數量（使用者回饋 2026-10-23，參考設計圖二）：
              重新規劃不是這頁最主要的動作，佔一整排太搶戲。 */}
          <View style={styles.headerRow}>
            <Text style={[styles.routeCount, { color: colors.text }]}>{t('routeResultsCount', { count: routes.length })}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.navigate('/plan')} style={styles.replanButton}>
              <Icon name="refresh" size={14} color={tones.accent} />
              <Text style={[styles.replanButtonText, { color: tones.accent }]}>{t('nativePlanAgain')}</Text>
            </Pressable>
          </View>
          {preferences ? <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>
            {t('nativeEffectiveRoute', { mode: t(`nativeRouteMode_${preferences.mode}`), travel: t(`nativeTravel_${preferences.travelMode}`), transit: t(`nativeTransit_${preferences.transitPreference}`) })}
            {preferences.departureTime ? ` · ${new Date(preferences.departureTime).toLocaleString()}` : ''}
            {preferences.avoidStairs ? ` · ${t('nativeAvoidStairs')}` : ''}
            {preferences.requireElevator ? ` · ${t('nativeRequireElevator')}` : ''}
          </Text> : null}
          {slope && !slope.enforced ? (
            <View accessible style={routeStyles.row}>
              <Icon name="alert" size={16} color={colors.textSecondary} />
              <Text style={[routeStyles.metaText, routeStyles.flex, { color: colors.text }]}>
                {slope.note ?? t('nativeSlopeNotEnforced', { percent: slope.requestedMaxPercent })}
              </Text>
            </View>
          ) : null}
          <RouteSafetyNotice />
          <View style={routeStyles.section}>
            {routes.map((route, index) => (
              <RouteCard
                key={route.routeId || String(index)}
                route={route}
                selected={selected?.index === index}
                onSelect={() => selectRouteAt(index)}
                onStartNavigation={onStartNavigation}
                onOpenDetail={() => {
                  selectRouteAt(index);
                  router.navigate({ pathname: '/routes/[index]', params: { index: String(index) } });
                }}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  routeCount: { fontSize: 15, fontWeight: '600' },
  replanButton: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, paddingHorizontal: 4 },
  replanButtonText: { fontSize: 14, fontWeight: '600' },
});
