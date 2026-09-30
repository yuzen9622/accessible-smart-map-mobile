import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { useThemeColors } from '@/shared/theme';
import { GlassCard, Icon } from '@/shared/ui';

import { endRouteSession, fitSelectedRoute } from '../controller/routeSessionPort';
import { hasRouteSession, routeResumeTarget, sheetModeFromPath, shouldShowRoutePill } from '../domain/routeSession';
import { useRouteSessionStore } from '../store/routeSessionStore';
import { routeTones } from './palette';

const PILL_MAX_FONT_SCALE = 1.3;

export interface RouteSessionPillProps {
  /** 由 app 組裝注入 navigation 的狀態（route 不 import navigation）。 */
  isNavigating: boolean;
  /** AI 聊天開啟時覆蓋路線流程的例外（Phase 4 前恆為 false）。 */
  chatOpen?: boolean;
}

/**
 * 「回到路線」常駐 pill（Web `RouteSessionPill.tsx`）：守住「路線幾何在地圖上 ⟺ 有出口」不變量。
 * 點本體回到規劃結果（或表單）並框回路線；✕ 是結束路線的唯一 UI 入口之一（`endRouteSession`）。
 */
export default function RouteSessionPill({ isNavigating, chatOpen = false }: RouteSessionPillProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const tones = routeTones(useColorScheme() === 'dark');
  const pathname = usePathname();
  const computeRoutes = useRouteSessionStore((s) => s.computeRoutes);
  const selectRoute = useRouteSessionStore((s) => s.selectRoute);
  const destination = useRouteSessionStore((s) => s.destination);
  const destinationName = useRouteSessionStore((s) => s.destinationName);

  const visible = shouldShowRoutePill({
    hasSession: hasRouteSession({ computeRoutes, selectRoute, destination }),
    sheetMode: sheetModeFromPath(pathname),
    isNavigating,
    chatOpen,
  });
  if (!visible) return null;

  const label = destinationName ? t('routeSessionPillTo', { destination: destinationName }) : t('routeSessionPillGeneric');
  const minutes = selectRoute ? Math.round(selectRoute.route.totalMinutes) : null;

  const resume = () => {
    const target = routeResumeTarget(computeRoutes);
    router.navigate(target === 'route' ? '/routes' : '/plan');
    fitSelectedRoute();
  };

  return (
    <GlassCard style={styles.pill} interactive>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('routeSessionPillResume')}，${label}${minutes !== null ? `，${t('minutesLeft', { count: minutes })}` : ''}`}
        onPress={resume}
        style={styles.body}>
        <Icon name="navigation" size={16} color={tones.accent} />
        {/* 浮在地圖上的膠囊：字級上限 1.3 倍。最大字級時目的地被擠成「前…」、分鐘數佔滿整顆膠囊（截圖實測） */}
        <Text style={[styles.label, { color: colors.text }]} numberOfLines={1} maxFontSizeMultiplier={PILL_MAX_FONT_SCALE}>
          {label}
        </Text>
        {minutes !== null ? (
          <Text style={[styles.minutes, { color: tones.ok }]} maxFontSizeMultiplier={PILL_MAX_FONT_SCALE}>
            {t('minutesLeft', { count: minutes })}
          </Text>
        ) : null}
      </Pressable>
      <View style={[styles.separator, { backgroundColor: colors.textSecondary }]} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('routeSessionPillEnd')} onPress={endRouteSession} style={styles.close}>
        <Icon name="close" size={16} color={colors.textSecondary} />
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', maxWidth: 340, borderRadius: 24 },
  body: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingLeft: 16, paddingRight: 8, flexShrink: 1 },
  label: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  minutes: { fontSize: 14, fontWeight: '600' },
  separator: { width: StyleSheet.hairlineWidth, height: 24, opacity: 0.4 },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
