import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { mapCamera } from '@/features/map';
import { useAppTranslation } from '@/shared/i18n';
import { useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import BusRow from '../components/BusRow';
import { badgePillTone, badgeText } from '../components/busText';
import EtaPill from '../components/EtaPill';
import { BUS_ACCENT_COLOR, BUS_ACCENT_COLOR_DARK } from '../components/palette';
import SegmentedPills from '../components/SegmentedPills';
import {
  defaultDirection,
  firstParam,
  resolveDirectionLabels,
  resolveStopBadge,
  stopsOfDirection,
  type RouteDetailStop,
} from '../domain';
import { useBusRouteDetail } from '../hooks/useBusRouteDetail';
import { useBusPanelStore, type PanelStop } from '../store/busPanelStore';

const STOP_ZOOM = 17;

function stopId(stop: RouteDetailStop): string {
  return `${stop.seq}:${stop.name}`;
}

/** 路線詳情：方向切換＋逐站到站時間，每 30 秒自動更新，可下拉更新。 */
export default function BusRouteScreen() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const isDark = useColorScheme() === 'dark';
  const params = useLocalSearchParams<{ routeName?: string; city?: string; departure?: string; destination?: string }>();
  const routeName = firstParam(params.routeName);
  const city = firstParam(params.city);
  const route = { departure: firstParam(params.departure), destination: firstParam(params.destination) };

  const { directions, loading, refreshing, error, refresh } = useBusRouteDetail(routeName, city);
  const [picked, setPicked] = useState<0 | 1 | null>(null);
  const direction = picked !== null && directions.some((d) => d.direction === picked) ? picked : defaultDirection(directions);
  const stops = stopsOfDirection(directions, direction);
  const labels = resolveDirectionLabels(directions, route);

  const selectedStopId = useBusPanelStore((s) => s.selectedStopId);
  const setDisplayedStops = useBusPanelStore((s) => s.setDisplayedStops);
  const selectStop = useBusPanelStore((s) => s.selectStop);
  const clearPanel = useBusPanelStore((s) => s.clear);

  // 回到此畫面（含從站牌詳情返回）時重新把站序交給地圖；離開時清掉。
  useFocusEffect(
    useCallback(() => {
      const panelStops: PanelStop[] = stops.map((s) => ({ id: stopId(s), name: s.name, lat: s.lat, lng: s.lng }));
      setDisplayedStops(panelStops);
      // 輪詢換了站序物件時只重設站點，不動選取（否則每 30 秒選取就被清掉）。
      return () => setDisplayedStops([]);
    }, [stops, setDisplayedStops]),
  );
  // 失焦（離開或推入子畫面）才整個清掉，包含選取。
  useFocusEffect(useCallback(() => clearPanel, [clearPanel]));
  useEffect(() => clearPanel, [clearPanel]);

  const accent = isDark ? BUS_ACCENT_COLOR_DARK : BUS_ACCENT_COLOR;

  const onSelectStop = (stop: RouteDetailStop) => {
    selectStop(stopId(stop));
    mapCamera.flyTo([stop.lng, stop.lat], STOP_ZOOM);
  };

  return (
    <>
      <Stack.Screen options={{ title: routeName }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
        <View style={styles.header}>
          <View style={styles.eyebrow}>
            <Icon name="bus" size={14} color={accent} />
            <Text style={[styles.eyebrowText, { color: accent }]}>{t('busInfo')}</Text>
          </View>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            {routeName}
          </Text>
          {route.departure || route.destination ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{`${route.departure} - ${route.destination}`}</Text>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.message} accessibilityLabel={t('loading')}>
            <ActivityIndicator color={colors.textSecondary} />
          </View>
        ) : directions.length === 0 ? (
          <View style={styles.message}>
            <Text accessibilityLiveRegion="polite" style={[styles.messageText, { color: colors.textSecondary }]}>
              {error === 'NO_DATA' || error === null ? t('noBusData') : t('networkError')}
            </Text>
          </View>
        ) : (
          <>
            <SegmentedPills
              options={[
                { value: 0 as const, label: t('nativeBusHeadingTo', { name: labels.destination }) },
                { value: 1 as const, label: t('nativeBusHeadingTo', { name: labels.departure }) },
              ].filter((o) => directions.some((d) => d.direction === o.value))}
              value={direction}
              onChange={(value) => {
                setPicked(value);
                selectStop(null);
              }}
            />
            {stops.length === 0 ? (
              <View style={styles.message}>
                <Text style={[styles.messageText, { color: colors.textSecondary }]}>{t('nativeBusNoStops')}</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {stops.map((stop) => {
                  const badge = resolveStopBadge(stop);
                  const eta = badgeText(t, badge);
                  return (
                    <BusRow
                      key={stopId(stop)}
                      title={`${stop.seq}. ${stop.name}`}
                      selected={selectedStopId === stopId(stop)}
                      trailing={<EtaPill text={eta} tone={badgePillTone(badge)} />}
                      accessibilityLabel={t('nativeBusStopEtaRowLabel', { seq: stop.seq, name: stop.name, eta })}
                      onPress={() => onSelectStop(stop)}
                    />
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  header: { gap: 4 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrowText: { fontSize: 13, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 15 },
  list: { gap: 8 },
  message: { alignItems: 'center', paddingVertical: 24 },
  messageText: { fontSize: 15, textAlign: 'center' },
});
