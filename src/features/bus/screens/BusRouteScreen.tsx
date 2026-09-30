import { Stack, useFocusEffect, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { mapCamera, useMapUiStore } from '@/features/map';
import { useAppTranslation } from '@/shared/i18n';
import { TYPE, semanticColors, useThemeColors } from '@/shared/theme';
import { Icon, SegmentedControl } from '@/shared/ui';

import { badgePillTone, badgeText } from '../components/busText';
import EtaPill from '../components/EtaPill';
import { etaDisplay } from '../components/etaDisplay';
import RouteBadge from '../components/RouteBadge';
import StopAxisRow from '../components/StopAxisRow';
import TrackingCard, { buildTrackingNodes } from '../components/TrackingCard';
import {
  arrivalReminderKey,
  REMINDER_LEAD_MINUTES,
  refreshArrivalReminder,
  startArrivalReminder,
  stopArrivalReminder,
  useArrivalReminderActive,
} from '../controller/arrivalReminder';
import {
  defaultDirection,
  firstParam,
  matchStopInRoute,
  nextBusToStop,
  parseFiniteParam,
  placeBuses,
  resolveDirectionLabels,
  resolveStopBadge,
  isAccessibleBus,
  stopsBounds,
  stopsOfDirection,
  type RouteDetailStop,
} from '../domain';
import { useBusRouteDetail } from '../hooks/useBusRouteDetail';
import { useRouteLiveBuses } from '../hooks/useRouteLiveBuses';
import { useBusPanelStore, type PanelStop } from '../store/busPanelStore';

const STOP_ZOOM = 17;
/** 對焦時避開頂部狀態列與右側浮動控制（定位、3D、SOS 約 70pt 寬）；左右同路線規劃至少 40。 */
const FIT_EDGE_PADDING = { top: 70, left: 40, right: 90 };

function stopId(stop: RouteDetailStop): string {
  return `${stop.seq}:${stop.name}`;
}

function parseDirection(value: string): 0 | 1 | null {
  return value === '0' ? 0 : value === '1' ? 1 : null;
}

/**
 * 路線詳情——設計 2b「追一班車」＋ 2a「完整站序」（2026-09-30）。
 *
 * 從站牌進來（帶 `stopName`）時，頂端追蹤「會到你這站的那班車」：大字倒數、車子和你之間還差幾站、
 * 到站提醒。下方是站序：一條實線軸、公車畫在軸上、你這站淡底；從車子前一站開始列，前面的站收成
 * 「顯示前面 N 站」（點開就是完整站序），打開時追車卡與你這站在同一個畫面。選中你這站之後的站
 * 可以設為下車站。每 30 秒自動更新，可下拉更新。
 */
export default function BusRouteScreen() {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const isDark = useColorScheme() === 'dark';
  const semantic = semanticColors(isDark);
  const params = useLocalSearchParams<{
    routeName?: string;
    city?: string;
    departure?: string;
    destination?: string;
    stopName?: string;
    direction?: string;
    stopLat?: string;
    stopLng?: string;
  }>();
  const routeName = firstParam(params.routeName);
  const city = firstParam(params.city);
  const route = { departure: firstParam(params.departure), destination: firstParam(params.destination) };
  const myStopName = firstParam(params.stopName);
  const stopLat = parseFiniteParam(params.stopLat);
  const stopLng = parseFiniteParam(params.stopLng);
  const stopPosition = stopLat !== null && stopLng !== null ? { lat: stopLat, lng: stopLng } : null;

  const { directions, loading, refreshing, error, refresh } = useBusRouteDetail(routeName, city);
  const [picked, setPicked] = useState<0 | 1 | null>(parseDirection(firstParam(params.direction)));
  const direction = picked !== null && directions.some((d) => d.direction === picked) ? picked : defaultDirection(directions);
  const stops = stopsOfDirection(directions, direction);
  const labels = resolveDirectionLabels(directions, route);
  const { buses, settled: busesSettled } = useRouteLiveBuses(routeName, city, direction);
  const placed = direction === null ? [] : placeBuses(stops, buses, direction);
  // 只給 useFocusEffect 用的一份站序參照：`stops` 會被傳進其他函式，React Compiler 會把它視為可能被改動而放棄 memo
  const focusStops = stopsOfDirection(directions, direction);

  const match = myStopName && direction !== null ? matchStopInRoute(directions, myStopName, stopPosition, direction) : null;
  const approaching = match ? nextBusToStop(placed, match.index, match.stop.estimateMinutes) : null;
  const [alight, setAlight] = useState<{ direction: 0 | 1 | null; seq: number } | null>(null);
  const alightSeq = alight && alight.direction === direction ? alight.seq : null;
  const alightIndex = alightSeq === null ? -1 : stops.findIndex((s) => s.seq === alightSeq);

  const selectedStopId = useBusPanelStore((s) => s.selectedStopId);
  const setDisplayedStops = useBusPanelStore((s) => s.setDisplayedStops);
  const selectStop = useBusPanelStore((s) => s.selectStop);
  const clearPanel = useBusPanelStore((s) => s.clear);

  // 回到此畫面（含從站牌詳情返回）時重新把站序交給地圖；離開時清掉。
  useFocusEffect(
    useCallback(() => {
      const panelStops: PanelStop[] = focusStops.map((s) => ({ id: stopId(s), name: s.name, lat: s.lat, lng: s.lng }));
      setDisplayedStops(panelStops);
      // 輪詢換了站序物件時只重設站點，不動選取（否則每 30 秒選取就被清掉）。
      return () => setDisplayedStops([]);
    }, [focusStops, setDisplayedStops]),
  );
  // 失焦（離開或推入子畫面）才整個清掉，包含選取。
  useFocusEffect(useCallback(() => clearPanel, [clearPanel]));
  useEffect(() => clearPanel, [clearPanel]);

  // 地圖：站序連成路線、你的站放大、該方向的即時車輛畫成 marker（設計：路線詳情的地圖）。
  const setRouteOverlay = useBusPanelStore((s) => s.setRouteOverlay);
  const setPanelBuses = useBusPanelStore((s) => s.setBuses);
  const mineStopId = match ? stopId(match.stop) : null;
  // 失焦時 clearPanel 會清掉這些；回到畫面（focused 變回 true）時重畫。
  const focused = useIsFocused();
  useEffect(() => {
    if (focused) setRouteOverlay({ routeLine: true, mineStopId });
  }, [focused, mineStopId, setRouteOverlay]);
  useEffect(() => {
    if (!focused) return;
    setPanelBuses(
      buses
        .filter((b) => b.direction === direction)
        .map((b) => ({ plateNumb: b.plateNumb, lat: b.lat, lng: b.lng, accessible: isAccessibleBus(b) })),
    );
  }, [buses, direction, focused, setPanelBuses]);

  // --- 到站提醒 ---
  const reminderKey = match && direction !== null ? arrivalReminderKey(city, routeName, direction, match.stop.name) : '';
  const reminderActive = useArrivalReminderActive(reminderKey);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const eta = match ? etaDisplay(t, match.stop) : null;
  const etaMinutes = match?.stop.estimateMinutes ?? null;
  const reminderContent = (minutes: number) => ({
    title: t('nativeBusReminderTitle', { route: routeName }),
    body: t('nativeBusReminderBody', { minutes: Math.max(1, Math.min(REMINDER_LEAD_MINUTES, Math.round(minutes))), stop: match?.stop.name ?? '' }),
  });
  const contentRef = useRef(reminderContent);
  useEffect(() => {
    contentRef.current = reminderContent;
  });
  useEffect(() => {
    if (!reminderKey || etaMinutes === null || etaMinutes < 0) return;
    const run = async () => {
      try {
        await refreshArrivalReminder(reminderKey, etaMinutes, contentRef.current(etaMinutes));
      } catch (err) {
        console.warn('[bus] reminder refresh failed', err);
      }
    };
    void run();
  }, [reminderKey, etaMinutes]);

  const toggleReminder = async () => {
    setReminderError(null);
    try {
      if (reminderActive) {
        await stopArrivalReminder(reminderKey);
        return;
      }
      if (etaMinutes === null || etaMinutes < 0) return;
      const granted = await startArrivalReminder(reminderKey, etaMinutes, reminderContent(etaMinutes));
      if (!granted) setReminderError(t('nativeBusReminderDenied'));
    } catch (err) {
      console.warn('[bus] reminder toggle failed', err);
      setReminderError(t('nativeBusReminderFailed'));
    }
  };

  // --- 站序從車子前一站開始（設計 2b「不先列 40 個站」），前面的站收成一列，點開看完整站序（2a） ---
  const [expandedFor, setExpandedFor] = useState<0 | 1 | null>(null);
  const trackedFrom = match ? Math.min(approaching?.bus.index ?? match.index, match.index) : 0;
  const collapsedCount = expandedFor !== null && expandedFor === direction ? 0 : Math.max(0, trackedFrom - 1);

  // 鏡頭對到「車子 → 你這站」這一段（沒有你的站就是整條路線）。等站序與車輛位置都回來才對焦，
  // 之後 sheet 高度（地圖底部 inset）改變時再對一次：相機 padding 跟著 sheet 走，高 sheet 時對的焦在 sheet 降下後會偏出畫面。
  // 使用者點了某一站（地圖飛到那站）就不再搶鏡頭。
  const fitFrom = match ? trackedFrom - 1 : 0;
  const fitTo = match ? match.index + 2 : Number.POSITIVE_INFINITY;
  const readyDirection = focusStops.length > 0 && busesSettled ? direction : null;
  const sheetInset = Math.round(useMapUiStore((st) => st.sheetInset));
  const fittedFor = useRef<string | null>(null);
  const fitKey = readyDirection === null || selectedStopId !== null || !focused ? null : `${readyDirection}:${sheetInset}`;
  useEffect(() => {
    if (fitKey === null || fittedFor.current === fitKey) return;
    fittedFor.current = fitKey;
    const bounds = stopsBounds(focusStops, fitFrom, Math.min(fitTo, focusStops.length - 1));
    if (bounds) mapCamera.fitBounds(bounds, FIT_EDGE_PADDING);
  }, [fitKey, focusStops, fitFrom, fitTo]);

  const onSelectStop = (stop: RouteDetailStop) => {
    selectStop(stopId(stop));
    mapCamera.flyTo([stop.lng, stop.lat], STOP_ZOOM);
  };

  const headsign = direction === 1 ? labels.departure : labels.destination;
  const subtitle = [route.departure && route.destination ? `${route.departure} – ${route.destination}` : '', t('nativeBusRefreshNote')]
    .filter(Boolean)
    .join(' · ');

  const renderTracking = () => {
    if (!match || !eta) return null;
    const accessible = approaching?.bus.accessible ?? false;
    const busLabel = approaching
      ? approaching.stopsAway === 0
        ? t('nativeBusAtYourStop')
        : `${stops[approaching.bus.index]?.name ?? ''} · ${t('nativeBusStopsAway', { count: approaching.stopsAway })}`
      : null;
    const rideSummary =
      alightIndex > match.index ? t('nativeBusRideSummary', { stop: stops[alightIndex]?.name ?? '', count: alightIndex - match.index }) : null;
    const reminderLabel = reminderActive ? t('nativeBusReminderOn', { minutes: REMINDER_LEAD_MINUTES }) : t('nativeBusRemindMe');
    return (
      <TrackingCard
        title={accessible ? t('nativeBusTrackTitleAccessible') : t('nativeBusTrackTitle')}
        minutes={eta.minutes}
        etaText={eta.text}
        etaTone={eta.tone}
        minuteUnit={t('nativeBusMinuteUnit')}
        nodes={approaching ? buildTrackingNodes(approaching.bus.index, match.index) : null}
        busLabel={busLabel}
        mineLabel={t('nativeBusYourStop')}
        busAccessible={accessible}
        noBusText={t('nativeBusTrackNoBus')}
        rideSummary={rideSummary}
        reminderLabel={reminderLabel}
        reminderActive={reminderActive}
        reminderDisabled={!reminderActive && (etaMinutes === null || etaMinutes < 0)}
        reminderError={reminderError}
        onToggleReminder={() => void toggleReminder()}
      />
    );
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
          <View style={styles.titleRow}>
            <RouteBadge name={routeName} />
            {headsign ? (
              <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                {t('nativeBusHeadingTo', { name: headsign })}
              </Text>
            ) : null}
          </View>
          <View style={styles.eyebrow}>
            <Icon name="bus" size={14} color={colors.textSecondary} />
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          </View>
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
            {renderTracking()}
            <SegmentedControl
              label={t('nativeBusDirectionLabel')}
              options={(
                [
                  { value: '0', label: t('nativeBusHeadingTo', { name: labels.destination }), selected: direction === 0 },
                  { value: '1', label: t('nativeBusHeadingTo', { name: labels.departure }), selected: direction === 1 },
                ] as const
              ).filter((o) => directions.some((d) => String(d.direction) === o.value))}
              onSelect={(value) => {
                setPicked(value === '1' ? 1 : 0);
                selectStop(null);
              }}
            />
            {stops.length === 0 ? (
              <View style={styles.message}>
                <Text style={[styles.messageText, { color: colors.textSecondary }]}>{t('nativeBusNoStops')}</Text>
              </View>
            ) : (
              <View>
                {collapsedCount > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setExpandedFor(direction)}
                    style={({ pressed }) => [styles.earlier, pressed && styles.pressed]}>
                    <Icon name="chevronUp" size={16} color={semantic.accent} />
                    <Text style={[styles.earlierText, { color: semantic.accent }]}>
                      {t('nativeBusShowEarlierStops', { count: collapsedCount })}
                    </Text>
                  </Pressable>
                ) : null}
                {stops.map((stop, index) => {
                  if (index < collapsedCount) return null;
                  const badge = resolveStopBadge(stop);
                  const etaText = badgeText(t, badge);
                  const busHere = placed.filter((b) => b.index === index);
                  const bus = busHere.length === 0 ? null : busHere.some((b) => b.accessible);
                  const mine = match?.index === index;
                  const selected = selectedStopId === stopId(stop);
                  const isAlight = alightSeq === stop.seq;
                  const canAlight = match !== null && index > match.index;
                  const busSpoken = bus === null ? '' : `，${bus ? t('nativeBusOnAxisAccessible') : t('nativeBusOnAxis')}`;
                  return (
                    <StopAxisRow
                      key={stopId(stop)}
                      name={stop.name}
                      note={mine ? t('nativeBusYouAreHere') : undefined}
                      tag={isAlight ? t('nativeBusAlight') : mine ? t('nativeBusBoard') : undefined}
                      first={index === 0 || index === collapsedCount}
                      last={index === stops.length - 1}
                      mine={mine}
                      selected={selected && !mine}
                      bus={bus}
                      trailing={<EtaPill text={etaText} tone={badgePillTone(badge)} />}
                      accessibilityLabel={`${t('nativeBusStopEtaRowLabel', { seq: stop.seq, name: stop.name, eta: etaText })}${mine ? `，${t('nativeBusYouAreHere')}` : ''}${busSpoken}`}
                      onPress={() => onSelectStop(stop)}
                      footer={
                        selected && canAlight ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => setAlight(isAlight ? null : { direction, seq: stop.seq })}
                            style={({ pressed }) => [styles.alightButton, { borderColor: semantic.accent }, pressed && styles.pressed]}>
                            <Icon name="flag" size={14} color={semantic.accent} />
                            <Text style={[styles.alightText, { color: semantic.accent }]}>
                              {isAlight ? t('nativeBusClearAlight') : t('nativeBusSetAlight')}
                            </Text>
                          </Pressable>
                        ) : undefined
                      }
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
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 14 },
  header: { gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontSize: TYPE.headline, fontWeight: '700' },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subtitle: { fontSize: TYPE.subhead, flexShrink: 1 },
  message: { alignItems: 'center', paddingVertical: 24 },
  messageText: { fontSize: TYPE.callout, textAlign: 'center' },
  alightButton: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
  },
  alightText: { fontSize: TYPE.subhead, fontWeight: '600' },
  earlier: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingLeft: 8 },
  earlierText: { fontSize: TYPE.callout, fontWeight: '600' },
  pressed: { opacity: 0.6 },
});
