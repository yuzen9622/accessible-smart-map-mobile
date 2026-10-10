import { Text } from '@/shared/ui/typography/Text';
import { Stack, useFocusEffect, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { mapCamera, useMapUiStore } from '@/features/map';
import { useAppTranslation } from '@/shared/i18n';
import { logger } from '@/shared/logger';
import { TYPE, useSemanticColors, useThemeColors } from '@/shared/theme';
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
  buildDirectionOptions,
  directionTitle,
  firstParam,
  isAccessibleBus,
  isTrackableDirection,
  matchStopInRoute,
  parseDirectionParam,
  parseFiniteParam,
  placeBuses,
  resolveDirectionOption,
  resolveStopBadge,
  routePathOfOption,
  selectionOf,
  stopsBounds,
  stopsOfOption,
  type DirectionOption,
  type DirectionTitle,
  type RouteDetailDirection,
  type RouteDetailStop,
} from '../domain';
import { useBusRouteDetail } from '../hooks/useBusRouteDetail';
import { useRouteLiveBuses } from '../hooks/useRouteLiveBuses';
import { useTrackedArrival } from '../hooks/useTrackedArrival';
import { useBusPanelStore, type PanelStop } from '../store/busPanelStore';

const STOP_ZOOM = 17;
/** 對焦時避開頂部狀態列與右側浮動控制（定位、3D、SOS 約 70pt 寬）；左右同路線規劃至少 40。 */
const FIT_EDGE_PADDING = { top: 70, left: 40, right: 90 };

function stopId(seq: number, name: string): string {
  return `${seq}:${name}`;
}

/**
 * 回到畫面（含從站牌詳情返回）時重新把選定那組站序與線形交給地圖；離開時清掉。輪詢換了站序物件時只重設站點與線形，
 * 不動選取（否則每 30 秒選取就被清掉）。獨立成 hook：站序物件在畫面本體會被傳進許多函式，
 * 放在同一個元件裡 React Compiler 會把 useCallback 的依賴視為可能被改動而放棄 memo。
 */
function useRoutePanelStops(directions: readonly RouteDetailDirection[], selectedIndex: number | null): void {
  const setDisplayedStops = useBusPanelStore((s) => s.setDisplayedStops);
  const setRoutePath = useBusPanelStore((s) => s.setRoutePath);
  useFocusEffect(
    useCallback(() => {
      const panelStops: PanelStop[] = stopsOfOption(directions, selectedIndex).map((s) => ({
        id: stopId(s.seq, s.name),
        name: s.name,
        lat: s.lat,
        lng: s.lng,
      }));
      setDisplayedStops(panelStops);
      setRoutePath(routePathOfOption(directions, selectedIndex));
      return () => {
        setDisplayedStops([]);
        setRoutePath([]);
      };
    }, [directions, selectedIndex, setDisplayedStops, setRoutePath]),
  );
}

/** 對焦一次：同一個 key 不重複對焦（輪詢換了站序物件、使用者拖動地圖都不搶鏡頭）。 */
function useFitCamera(fitKey: string | null, stops: readonly RouteDetailStop[], fitFrom: number, fitTo: number): void {
  const fittedFor = useRef<string | null>(null);
  useEffect(() => {
    if (fitKey === null || fittedFor.current === fitKey) return;
    fittedFor.current = fitKey;
    const bounds = stopsBounds(stops, fitFrom, Math.min(fitTo, stops.length - 1));
    if (bounds) mapCamera.fitBounds(bounds, FIT_EDGE_PADDING);
  }, [fitKey, stops, fitFrom, fitTo]);
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
  const semantic = useSemanticColors();
  const params = useLocalSearchParams<{
    routeName?: string;
    city?: string;
    departure?: string;
    destination?: string;
    stopName?: string;
    direction?: string;
    subRouteUid?: string;
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
  // 選擇以實際方向物件（支線＋方向）識別，不只靠 direction 數字：同方向的不同支線各自一個選項。
  const options = buildDirectionOptions(directions);
  const selectionContext = JSON.stringify([routeName, city, firstParam(params.subRouteUid), parseDirectionParam(params.direction)]);
  const [picked, setPicked] = useState<{ context: string; key: string } | null>(null);
  const pickedKey = picked?.context === selectionContext ? picked.key : null;
  const selected = resolveDirectionOption(options, {
    key: pickedKey,
    subRouteUid: firstParam(params.subRouteUid) || undefined,
    direction: parseDirectionParam(params.direction),
  });
  const selectedKey = selected?.key ?? null;
  // 自動選出的方向也屬於目前選擇；刷新新增 0 時不能把仍存在的 2／10 換掉。
  // 導覽目標改變時以新的 context 重新解析。僅在不一致時同步調整本元件 state，
  // 讓 React 在 commit 子元件與其查詢前重 render，避免 effect 帶來錯誤選擇的中間畫面。
  if (selectedKey !== null && selectedKey !== pickedKey) {
    setPicked({ context: selectionContext, key: selectedKey });
  }
  const selectedIndex = selected?.index ?? null;
  const stops = stopsOfOption(directions, selectedIndex);
  const selection = selected && !selected.ambiguous ? selectionOf(selected) : null;
  const { buses, settled: busesSettled } = useRouteLiveBuses(routeName, city, selection);
  const placed = selection ? placeBuses(stops, buses, selection) : [];

  const match =
    myStopName && selected ? matchStopInRoute(directions.filter((_, i) => i === selected.index), myStopName, stopPosition) : null;
  // 搭乘追蹤、到站提醒、下車站都要確定方向與支線：255（未知）或無法區分的重複組不做。
  const trackDirection = selected && !selected.ambiguous && isTrackableDirection(selected.direction) ? selected.direction : null;
  const trackMatch = trackDirection !== null ? match : null;
  // 單車資訊只來自鎖定同站、同支線、同方向的那一筆到站紀錄；route-detail 的站不擁有車牌。
  const tracked = useTrackedArrival(routeName, city, trackMatch ? myStopName : '', trackDirection !== null ? selection : null);
  const trackedPlate = tracked?.plateNumb;
  const trackedBus = trackMatch && trackedPlate ? (placed.find((b) => b.plateNumb === trackedPlate) ?? null) : null;
  const approaching =
    trackMatch && trackedBus && trackedBus.index <= trackMatch.index
      ? { bus: trackedBus, stopsAway: trackMatch.index - trackedBus.index }
      : null;
  const [alight, setAlight] = useState<{ key: string | null; seq: number } | null>(null);
  const alightSeq = trackMatch && alight && alight.key === selectedKey ? alight.seq : null;
  const alightIndex = alightSeq === null ? -1 : stops.findIndex((s) => s.seq === alightSeq);

  // 標題與選單文字要在下面的 useFocusEffect 之前算完：它們把 `directions` 交給別的函式，放在後面 React Compiler 會放棄 memo
  const titleOf = (option: DirectionOption): DirectionTitle => directionTitle(directions, option, route);
  const titleText = (title: DirectionTitle): string => {
    switch (title.kind) {
      case 'headsign':
        return title.name ? t('nativeBusHeadingTo', { name: title.name }) : '';
      case 'loop':
        return t('nativeBusDirectionLoop');
      case 'circular':
        return t('nativeBusDirectionCircular');
      case 'unknown':
        return t('nativeBusDirectionUnknown');
    }
  };
  // 同一路線有多個支線時，選項前面加支線名稱，才分得出同方向的不同支線。
  const hasBranches = new Set(options.map((o) => o.subRouteUid ?? '')).size > 1;
  const optionLabel = (option: DirectionOption): string => {
    const base = titleText(titleOf(option));
    return hasBranches && option.subRouteName ? t('nativeBusDirectionSubRoute', { sub: option.subRouteName, direction: base }) : base;
  };
  const headsign = selected ? titleText(titleOf(selected)) : '';
  const segmentOptions = options.map((o) => ({ value: o.key, label: optionLabel(o), selected: o.key === selectedKey }));
  const selectedStopId = useBusPanelStore((s) => s.selectedStopId);
  const selectStop = useBusPanelStore((s) => s.selectStop);
  const clearPanel = useBusPanelStore((s) => s.clear);

  // 失焦（離開或推入子畫面）才整個清掉，包含選取。
  useFocusEffect(useCallback(() => clearPanel, [clearPanel]));
  useEffect(() => clearPanel, [clearPanel]);

  // 地圖：畫路線線形（TDX 線形，沒有時站序連線）、你的站放大、該方向的即時車輛畫成 marker（設計：路線詳情的地圖）。
  const setRouteOverlay = useBusPanelStore((s) => s.setRouteOverlay);
  const setPanelBuses = useBusPanelStore((s) => s.setBuses);
  const mineStopId = match ? stopId(match.stop.seq, match.stop.name) : null;
  // 失焦時 clearPanel 會清掉這些；回到畫面（focused 變回 true）時重畫。
  const focused = useIsFocused();
  useEffect(() => {
    if (focused) setRouteOverlay({ routeLine: true, mineStopId });
  }, [focused, mineStopId, setRouteOverlay]);
  useEffect(() => {
    if (!focused) return;
    setPanelBuses(
      buses.map((b) => ({ plateNumb: b.plateNumb, lat: b.lat, lng: b.lng, accessible: isAccessibleBus(b) })),
    );
  }, [buses, focused, setPanelBuses]);

  // --- 到站提醒 ---
  // 提醒的 ETA 與追車卡同一來源：有車牌的那筆到站紀錄，否則是站序上這站的 ETA。
  const reminderKey =
    trackMatch && trackDirection !== null
      ? arrivalReminderKey(city, routeName, selected?.subRouteUid, trackDirection, trackMatch.stop.name)
      : '';
  const reminderActive = useArrivalReminderActive(reminderKey);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const etaSource = trackedPlate ? { estimateMinutes: tracked?.estimateMinutes ?? null, statusLabel: '' } : (trackMatch?.stop ?? null);
  const eta = etaSource ? etaDisplay(t, etaSource) : null;
  const rawEta = etaSource?.estimateMinutes ?? null;
  const etaMinutes = rawEta !== null && Number.isFinite(rawEta) && rawEta >= 0 ? rawEta : null;
  const reminderContent = (minutes: number) => ({
    title: t('nativeBusReminderTitle', { route: routeName }),
    body: t('nativeBusReminderBody', { minutes: Math.max(1, Math.min(REMINDER_LEAD_MINUTES, Math.round(minutes))), stop: trackMatch?.stop.name ?? '' }),
  });
  const contentRef = useRef(reminderContent);
  useEffect(() => {
    contentRef.current = reminderContent;
  });
  // 切到別的方向／支線或離開追蹤狀態時取消舊提醒；離開畫面（卸載）則保留，使用者可以先收起畫面等車。
  const unmounting = useRef(false);
  useEffect(() => {
    unmounting.current = false;
    return () => {
      unmounting.current = true;
    };
  }, []);
  useEffect(() => {
    if (!reminderKey) return;
    return () => {
      if (!unmounting.current) void stopArrivalReminder(reminderKey);
    };
  }, [reminderKey]);
  // ETA 更新就重排；沒有可用 ETA 時 refreshArrivalReminder 會取消原本排定的通知。
  useEffect(() => {
    if (!reminderKey) return;
    const run = async () => {
      try {
        await refreshArrivalReminder(reminderKey, etaMinutes, contentRef.current(etaMinutes ?? 0));
      } catch (err) {
        logger.warn('[bus] reminder refresh failed', err);
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
      if (etaMinutes === null) return;
      const result = await startArrivalReminder(reminderKey, etaMinutes, reminderContent(etaMinutes));
      if (result === 'denied') setReminderError(t('nativeBusReminderDenied'));
    } catch (err) {
      logger.warn('[bus] reminder toggle failed', err);
      setReminderError(t('nativeBusReminderFailed'));
    }
  };

  // --- 站序從車子前一站開始（設計 2b「不先列 40 個站」），前面的站收成一列，點開看完整站序（2a） ---
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const trackedFrom = match ? Math.min(approaching?.bus.index ?? match.index, match.index) : 0;
  const collapsedCount = expandedFor !== null && expandedFor === selectedKey ? 0 : Math.max(0, trackedFrom - 1);

  // 鏡頭對到「車子 → 你這站」這一段（沒有你的站就是整條路線）。等站序與車輛位置都回來才對焦，
  // 之後 sheet 高度（地圖底部 inset）改變時再對一次：相機 padding 跟著 sheet 走，高 sheet 時對的焦在 sheet 降下後會偏出畫面。
  // 使用者點了某一站（地圖飛到那站）就不再搶鏡頭。
  const fitFrom = match ? trackedFrom - 1 : 0;
  const fitTo = match ? match.index + 2 : Number.POSITIVE_INFINITY;
  const readyKey = stops.length > 0 && (busesSettled || selection === null) ? selectedKey : null;
  const sheetInset = Math.round(useMapUiStore((st) => st.sheetInset));
  const fitKey = readyKey === null || selectedStopId !== null || !focused ? null : `${readyKey}:${sheetInset}`;
  useFitCamera(fitKey, stops, fitFrom, fitTo);

  const onSelectStop = (stop: RouteDetailStop) => {
    selectStop(stopId(stop.seq, stop.name));
    mapCamera.flyTo([stop.lng, stop.lat], STOP_ZOOM);
  };

  const subtitle = [route.departure && route.destination ? `${route.departure} – ${route.destination}` : '', t('nativeBusRefreshNote')]
    .filter(Boolean)
    .join(' · ');

  const renderTracking = () => {
    if (selected?.direction === 255) {
      return (
        <Text accessibilityLiveRegion="polite" style={[styles.messageText, { color: colors.textSecondary }]}>
          {t('nativeBusTrackUnknownDirection')}
        </Text>
      );
    }
    if (!trackMatch || !eta) return null;
    const match = trackMatch;
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

  useRoutePanelStops(directions, selectedIndex);

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
                {headsign}
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
              options={segmentOptions}
              onSelect={(value) => {
                setPicked({ context: selectionContext, key: value });
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
                    onPress={() => setExpandedFor(selectedKey)}
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
                  const isSelected = selectedStopId === stopId(stop.seq, stop.name);
                  const isAlight = alightSeq === stop.seq;
                  const canAlight = trackMatch !== null && index > trackMatch.index;
                  const busSpoken = bus === null ? '' : `，${bus ? t('nativeBusOnAxisAccessible') : t('nativeBusOnAxis')}`;
                  return (
                    <StopAxisRow
                      key={stopId(stop.seq, stop.name)}
                      name={stop.name}
                      note={mine ? t('nativeBusYouAreHere') : undefined}
                      tag={isAlight ? t('nativeBusAlight') : mine ? t('nativeBusBoard') : undefined}
                      first={index === 0 || index === collapsedCount}
                      last={index === stops.length - 1}
                      mine={mine}
                      selected={isSelected && !mine}
                      bus={bus}
                      trailing={<EtaPill text={etaText} tone={badgePillTone(badge)} />}
                      accessibilityLabel={`${t('nativeBusStopEtaRowLabel', { seq: stop.seq, name: stop.name, eta: etaText })}${mine ? `，${t('nativeBusYouAreHere')}` : ''}${busSpoken}`}
                      onPress={() => onSelectStop(stop)}
                      footer={
                        isSelected && canAlight ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => setAlight(isAlight ? null : { key: selectedKey, seq: stop.seq })}
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
