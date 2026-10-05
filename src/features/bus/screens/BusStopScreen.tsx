import { Stack, useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { mapCamera, useUserLocationStore } from '@/features/map';
import { formatDistance, haversineMeters } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';
import { RADIUS, TYPE, useSemanticColors, useThemeColors } from '@/shared/theme';
import { Icon, SegmentedControl } from '@/shared/ui';

import { etaDisplay } from '../components/etaDisplay';
import NextAccessibleCard from '../components/NextAccessibleCard';
import { pillToneStyle } from '../components/palette';
import RouteBadge from '../components/RouteBadge';
import {
  busCityLabel,
  firstParam,
  isAccessibleArrival,
  parseFiniteParam,
  parseRouteListParam,
  pickFeaturedArrival,
  routesWithoutArrivals,
  sortArrivals,
  type StopArrival,
} from '../domain';
import { useStopArrivals } from '../hooks/useStopArrivals';
import { useBusPanelStore } from '../store/busPanelStore';

const STOP_ZOOM = 17;
const STOP_ID = 'focused-stop';

type BoardFilter = 'accessible' | 'all';

function arrivalKey(a: StopArrival): string {
  return `${a.routeName}:${a.subRouteUid ?? ''}:${a.direction}`;
}

/**
 * 站牌詳情——設計 2b「站牌（下一班優先）」（2026-09-30）：
 * 最上面一張主色卡只回答「下一班無障礙公車還要多久」，其餘路線的倒數靠右對齊，
 * 預設只列下一班是無障礙車的路線（segmented 切換全部）。開啟時把地圖飛到該站。
 *
 * 資料只來自一支 `/bus/stop-arrivals`（逐路線查會耗光共用 TDX 額度）；後端還沒有這支 API 時只列路線名稱。
 */
export default function BusStopScreen() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const isDark = useColorScheme() === 'dark';
  const semantic = useSemanticColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ stopName?: string; city?: string; lat?: string; lng?: string; routes?: string }>();
  const stopName = firstParam(params.stopName);
  const city = firstParam(params.city);
  const lat = parseFiniteParam(params.lat);
  const lng = parseFiniteParam(params.lng);
  const routes = parseRouteListParam(params.routes);
  const stopPosition = lat !== null && lng !== null ? { lat, lng } : null;
  const userPosition = useUserLocationStore((s) => s.position);

  const focused = useIsFocused();
  const board = useStopArrivals(stopName, city, stopPosition, focused);
  const [picked, setPicked] = useState<BoardFilter | null>(null);

  const setDisplayedStops = useBusPanelStore((s) => s.setDisplayedStops);
  const selectStop = useBusPanelStore((s) => s.selectStop);
  const clearPanel = useBusPanelStore((s) => s.clear);

  useFocusEffect(
    useCallback(() => {
      if (lat === null || lng === null) return;
      setDisplayedStops([{ id: STOP_ID, name: stopName, lat, lng }]);
      selectStop(STOP_ID);
      mapCamera.flyTo([lng, lat], STOP_ZOOM);
      return clearPanel;
    }, [lat, lng, stopName, setDisplayedStops, selectStop, clearPanel]),
  );
  useEffect(() => clearPanel, [clearPanel]);

  const sorted = sortArrivals(board.arrivals);
  const featured = pickFeaturedArrival(sorted);
  const missing = routesWithoutArrivals(routes, sorted);
  const accessibleCount = sorted.filter(isAccessibleArrival).length;
  const filter: BoardFilter = picked ?? (accessibleCount > 0 ? 'accessible' : 'all');
  const listed = sorted.filter((a) => a !== featured && (filter === 'all' || isAccessibleArrival(a)));

  // 只有去程／返程才有「往終點」；迴圈、循環線、方向未知不套終點（255 更不能當成有方向）。
  const headsignText = (a: StopArrival) => {
    if (a.direction === 0 || a.direction === 1) {
      return a.headsign ? t('nativeBusHeadingTo', { name: a.headsign }) : (a.subRouteName ?? a.routeName);
    }
    const label = a.direction === 2 ? t('nativeBusDirectionLoop') : a.direction === 10 ? t('nativeBusDirectionCircular') : t('nativeBusDirectionUnknown');
    return a.subRouteName && a.subRouteName !== a.routeName ? t('nativeBusDirectionSubRoute', { sub: a.subRouteName, direction: label }) : label;
  };
  const accessText = (a: StopArrival) => (a.isLowFloor ? t('nativeBusLowFloor') : t('nativeBusLiftOrRamp'));
  const stopParams = stopPosition ? { stopLat: String(stopPosition.lat), stopLng: String(stopPosition.lng) } : {};

  const openRoute = (a: StopArrival) =>
    router.navigate({
      pathname: '/bus/route',
      params: {
        routeName: a.routeName,
        city,
        stopName,
        direction: String(a.direction),
        ...(a.subRouteUid ? { subRouteUid: a.subRouteUid } : {}),
        ...stopParams,
      },
    });
  const openRouteByName = (routeName: string) =>
    router.navigate({ pathname: '/bus/route', params: { routeName, city, stopName, ...stopParams } });

  const distanceText =
    userPosition && stopPosition
      ? t('nativeBusStopDistance', { distance: formatDistance(haversineMeters(userPosition, stopPosition)) })
      : null;
  const subtitle = [busCityLabel(city), distanceText].filter(Boolean).join(' · ');
  const separator = (index: number) => index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: semantic.separator };

  const renderFeatured = (a: StopArrival) => {
    const eta = etaDisplay(t, a);
    const etaSpoken = eta.minutes !== null ? t('nativeBusEtaMinutes', { count: eta.minutes }) : eta.text;
    return (
      <NextAccessibleCard
        eyebrow={t('nativeBusNextAccessible')}
        routeName={a.routeName}
        detail={`${headsignText(a)} · ${accessText(a)}`}
        minutes={eta.minutes}
        etaText={eta.text}
        minuteUnit={t('nativeBusMinuteUnit')}
        accessibilityLabel={t('nativeBusFeaturedLabel', {
          route: a.routeName,
          headsign: headsignText(a),
          access: accessText(a),
          eta: etaSpoken,
        })}
        onPress={() => openRoute(a)}
      />
    );
  };

  const renderRow = (a: StopArrival, index: number) => {
    const eta = etaDisplay(t, a);
    const tone = pillToneStyle(eta.tone, isDark);
    const accessible = isAccessibleArrival(a);
    const etaSpoken = eta.minutes !== null ? t('nativeBusEtaMinutes', { count: eta.minutes }) : eta.text;
    const label = t('nativeBusBoardRowLabel', { route: a.routeName, headsign: headsignText(a), eta: etaSpoken });
    return (
      <Pressable
        key={arrivalKey(a)}
        accessibilityRole="button"
        accessibilityLabel={accessible ? `${label}，${accessText(a)}` : label}
        onPress={() => openRoute(a)}
        style={({ pressed }) => [styles.row, separator(index), pressed && styles.pressed]}>
        <RouteBadge name={a.routeName} />
        <View style={styles.rowTexts}>
          <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
            {headsignText(a)}
          </Text>
          {accessible ? (
            <View style={styles.accessTag}>
              <Icon name="accessibility" size={13} color={semantic.accent} />
              <Text style={[styles.accessText, { color: semantic.accent }]}>{accessText(a)}</Text>
            </View>
          ) : null}
        </View>
        {eta.minutes !== null ? (
          <Text style={{ color: tone.color }}>
            <Text style={styles.rowEta}>{eta.minutes}</Text>
            <Text style={styles.rowEtaUnit}> {t('nativeBusMinuteUnit')}</Text>
          </Text>
        ) : (
          <Text style={[styles.rowStatus, { color: tone.color }]} numberOfLines={2}>
            {eta.text}
          </Text>
        )}
      </Pressable>
    );
  };

  const renderNameRow = (routeName: string, index: number, note: string | null) => (
    <Pressable
      key={`name:${routeName}`}
      accessibilityRole="button"
      accessibilityLabel={note ? `${routeName}，${note}` : t('nativeBusStopRouteRowLabel', { route: routeName, stop: stopName })}
      onPress={() => openRouteByName(routeName)}
      style={({ pressed }) => [styles.row, separator(index), pressed && styles.pressed]}>
      <RouteBadge name={routeName} />
      <View style={styles.rowTexts} />
      {note ? <Text style={[styles.rowStatus, { color: colors.textSecondary }]}>{note}</Text> : null}
      <Icon name="chevronRight" size={16} color={colors.textSecondary} />
    </Pressable>
  );

  const renderBoard = () => {
    if (board.status === 'loading') {
      return (
        <View style={styles.loading} accessibilityLabel={t('loading')}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      );
    }
    // 後端沒有這站的到站資料：退回只列行經路線（點進去看逐站時間）。
    if (board.status === 'unavailable' || board.status === 'error') {
      return (
        <>
          {board.status === 'error' ? (
            <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.textSecondary }]}>
              {t('networkError')}
            </Text>
          ) : null}
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('nativeBusRoutesAtStop')}
          </Text>
          <View>{routes.map((routeName, i) => renderNameRow(routeName, i, null))}</View>
        </>
      );
    }
    return (
      <>
        {featured ? (
          renderFeatured(featured)
        ) : (
          <View style={[styles.noteCard, { backgroundColor: semantic.surface }]}>
            <Icon name="accessibility" size={18} color={colors.textSecondary} />
            <Text accessibilityLiveRegion="polite" style={[styles.noteText, { color: colors.textSecondary }]}>
              {t('nativeBusNoAccessibleSoon')}
            </Text>
          </View>
        )}

        <SegmentedControl
          label={t('nativeBusFilterLabel')}
          options={[
            {
              value: 'accessible' as const,
              label: t('nativeBusFilterAccessible', { count: accessibleCount }),
              selected: filter === 'accessible',
            },
            {
              value: 'all' as const,
              label: t('nativeBusFilterAll', { count: sorted.length + missing.length }),
              selected: filter === 'all',
            },
          ]}
          onSelect={setPicked}
        />

        {filter === 'accessible' && accessibleCount === 0 ? (
          <Text style={[styles.message, { color: colors.textSecondary }]}>{t('nativeBusNoAccessibleRoutes')}</Text>
        ) : (
          <View>
            {listed.map(renderRow)}
            {filter === 'all' ? missing.map((routeName, i) => renderNameRow(routeName, listed.length + i, t('nativeBusNoDataShort'))) : null}
          </View>
        )}

        <View style={styles.footer}>
          <Icon name="refresh" size={13} color={colors.textSecondary} />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>{t('nativeBusRefreshNote')}</Text>
        </View>
      </>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: stopName }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={board.refreshing} onRefresh={() => void board.refresh()} />}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            {stopName}
          </Text>
          {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
        </View>
        {routes.length === 0 && board.arrivals.length === 0 && board.status !== 'loading' ? (
          <Text style={[styles.message, { color: colors.textSecondary }]}>{t('noBusData')}</Text>
        ) : (
          renderBoard()
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 14 },
  header: { gap: 4 },
  title: { fontSize: TYPE.title, fontWeight: '700' },
  subtitle: { fontSize: TYPE.callout },
  sectionTitle: { fontSize: TYPE.subhead, fontWeight: '600' },
  loading: { alignItems: 'center', paddingVertical: 24 },
  message: { fontSize: TYPE.callout, textAlign: 'center', paddingVertical: 8 },
  noteCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: RADIUS.card },
  noteText: { flex: 1, fontSize: TYPE.callout },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10 },
  pressed: { opacity: 0.6 },
  rowTexts: { flex: 1, gap: 2 },
  rowTitle: { fontSize: TYPE.body, fontWeight: '500' },
  accessTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  accessText: { fontSize: TYPE.caption, fontWeight: '600' },
  rowEta: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  rowEtaUnit: { fontSize: TYPE.subhead, fontWeight: '600' },
  rowStatus: { fontSize: TYPE.subhead, fontWeight: '600', maxWidth: 110, textAlign: 'right' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  footerText: { fontSize: TYPE.caption },
});
