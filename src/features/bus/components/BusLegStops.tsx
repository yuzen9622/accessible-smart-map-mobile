import { Text } from '@/shared/ui/typography/Text';
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { StyleSheet, useColorScheme, View } from 'react-native';

import {
  candidateDeparture,
  followCandidate,
  formatRouteClock,
  getLegColor,
  minutesUntil,
  presentRouteNames,
  resolveViewedCandidate,
  type AccessibleRoute,
  type BusDepartureCandidate,
  type BusLeg,
  type LngLatTuple,
} from '@/features/route/domain';
import { getAppLanguage, useAppTranslation } from '@/shared/i18n';
import { useThemeColors, LIVE_DOT, TYPE, SHAPE } from '@/shared/theme';
import { useNow } from '@/shared/time';
import { Icon } from '@/shared/ui';

import {
  buildStopRows,
  fallbackStopRows,
  presentStopRowNames,
  resolveCurrentStopSeq,
  resolveEtaLabel,
  resolveLegStops,
  resolveCandidateRide,
  resolveLiveEta,
  resolveWaitText,
  type BusLegStopRow,
} from '../domain';
import { useBusLegStopEtas } from '../hooks/useBusLegStopEtas';
import { busLegKey, useBusStore } from '../store/busStore';
import BusDepartureChooser from './BusDepartureChooser';
import { busName, etaLabelText, etaTonePill } from './busText';
import EtaPill from './EtaPill';
import { BUS_BORDER_COLOR, BUS_ON_ACCENT_COLOR, pillToneStyle } from './palette';
import PressableScale from '@/shared/ui/PressableScale';

export interface BusLegStopsProps {
  route: AccessibleRoute;
  routeIndex: number;
  legIndex: number;
  leg: BusLeg;
  /**
   * 查看別班時，地圖改畫那班在上下車站之間的線形（null＝還原成規劃的那班）。由 app 路由組裝注入
   * route feature 的 `previewLegGeometry`：bus 不寫 route 的狀態。
   */
  onPreviewGeometry?: (polyline: LngLatTuple[] | null) => void;
}

/**
 * 路線詳情裡的公車 leg（對齊 Web `LegDetail` 的 BUS 分支＋`BusLegDetails`／`BusLegStops`）：
 * 可搭乘的班次（候選公車）、上車／下車列與可展開的中途站。展開才把這段 leg 設成 `activeBusLeg`
 * （啟動即時車輛）；收合時只有這段仍是 active 才清掉，避免蓋掉別段的展開。
 *
 * 查看別班只是本元件的區域狀態，不寫回規劃的 leg 或 store（導航仍搭規劃的那班）；點回帶導航圖示的那張就回到規劃班次。查看中的班次跨刷新跟著
 * 同一台車走（`followCandidate`）；它的上下車時刻取代規劃時刻，中途站序屬於規劃的路線所以收起。
 * 候選清單隨 `bus-arrivals` 每 20 秒刷新（這個畫面的重點就是即時時刻），倒數則每 30 秒依上車時刻重算。
 */
export default function BusLegStops({ route, routeIndex, legIndex, leg: rawLeg, onPreviewGeometry }: BusLegStopsProps) {
  const { t } = useAppTranslation();
  const lang = getAppLanguage();
  const projected = presentRouteNames(route, lang).legs[legIndex];
  const displayLeg = projected?.type === 'BUS' ? projected : rawLeg;
  const leg = useMemo(() => ({ ...rawLeg, planContext: route.routeToken ? { routeToken: route.routeToken, legIndex } : undefined }), [rawLeg, route.routeToken, legIndex]);
  const colors = useThemeColors();
  const isDark = useColorScheme() === 'dark';
  const key = busLegKey(route, routeIndex, legIndex, leg);
  const expanded = useBusStore((s) => s.activeBusLeg?.key === key);
  const liveBuses = useBusStore((s) => s.liveBusPositions);
  const { directions, status, candidates: refreshed } = useBusLegStopEtas(leg, true, true);
  const now = useNow(30_000);
  const [view, setView] = useState<{ key: string; candidate: BusDepartureCandidate } | null>(null);
  const candidates = refreshed ?? rawLeg.departureCandidates ?? [];
  const followed = view?.key === key ? followCandidate(candidates, view.candidate) : undefined;
  const viewed = resolveViewedCandidate(candidates, followed?.candidateId);
  const viewingPlanned = !viewed || viewed.selected;

  // 查看別班：那班不在規劃裡，向公開 route-detail 要它自己的站序與線形，依候選班次的上下車站 ID 切出這一段
  const other = viewed && !viewed.selected ? viewed : null;
  const otherLeg: BusLeg | null = other
    ? {
        ...rawLeg,
        routeName: other.routeName,
        subRouteName: other.subRouteName,
        subRouteUid: other.subRouteUid,
        direction: other.direction,
        planContext: undefined,
        scheduledTrip: undefined,
        intermediateStops: undefined,
      }
    : null;
  const otherEtas = useBusLegStopEtas(otherLeg, Boolean(otherLeg), true, true);
  const otherRide = other ? resolveCandidateRide(otherEtas.directions, other) : null;
  const otherPending = Boolean(other) && !otherRide && (otherEtas.status === 'idle' || otherEtas.status === 'loading');
  const [otherOpen, setOtherOpen] = useState(false);

  const previewPolyline = otherRide?.polyline ?? null;
  const pushPreview = useEffectEvent((polyline: LngLatTuple[] | null) => onPreviewGeometry?.(polyline));
  useEffect(() => {
    if (!previewPolyline) return;
    pushPreview(previewPolyline);
    return () => pushPreview(null);
  }, [previewPolyline]);

  const targetBus = liveBuses.find((b) => b.isTarget) ?? null;
  const legColor = getLegColor(leg);

  // 即時站序（bus-arrivals）一到就切出這趟的中途站，不必等展開：後端的 `intermediateStops` 可能缺漏，
  // 只靠它的話有些路段連「經過 N 個站點」都看不到。展開只決定要不要列出來與追蹤車輛。
  // bus-arrivals 刷新時後端可能改選另一條可行的路線（例如原本的 21 已開走、改搭 651），回傳的站序也換成那條；
  // 用目前 `selected` 的候選班次的子路線去切站序，不然會對不上規劃時的 subRouteUid 而整段消失。
  const ride = candidates.find((c) => c.selected);
  let rows: BusLegStopRow[] | undefined;
  const sliced = resolveLegStops(directions ?? undefined, ride ? { ...leg, subRouteUid: ride.subRouteUid } : leg);
  const hasRouteDetail = Boolean(sliced && sliced.length > 0);
  if (other) {
    rows = otherRide ? buildStopRows(otherRide.stops, null) : undefined;
  } else if (sliced && sliced.length > 0) {
    rows = presentStopRowNames(buildStopRows(sliced, resolveCurrentStopSeq(sliced, expanded ? targetBus : null)), displayLeg);
  } else if (expanded) {
    rows = presentStopRowNames(fallbackStopRows(displayLeg, { pending: status === 'idle' || status === 'loading' }), displayLeg);
  }
  const intermediateRows = rows && rows.length > 2 ? rows.slice(1, -1) : undefined;
  const currentStopName = rows?.find((r) => r.state === 'current');
  const currentStopLabel = busName(currentStopName?.displayName, currentStopName?.name);
  const stopCount = intermediateRows?.length ?? (other ? 0 : (leg.intermediateStops?.length ?? 0));
  const stopsOpen = other ? otherOpen : expanded;

  const toggle = () => {
    // 別班的站序只在這裡展開，不啟動地圖上規劃那班的即時追蹤
    if (other) {
      setOtherOpen((open) => !open);
      return;
    }
    const store = useBusStore.getState();
    if (expanded) {
      if (store.activeBusLeg?.key === key) store.setActiveBusLeg(null);
    } else {
      store.setActiveBusLeg({ key, leg, route });
    }
  };

  const waitText = resolveWaitText(leg.waitInfo);
  const liveEta = resolveLiveEta(rows?.[0]?.estimateMinutes);

  // 有候選班次時，上下車時刻一律跟著「查看中」的那班（預設就是規劃的那班）。
  const viewedDeparture = viewed ? candidateDeparture(viewed, now) : null;
  const viewedBoardEta =
    viewedDeparture?.kind === 'live'
      ? viewedDeparture.minutes <= 1
        ? { text: t('nativeBusDepartureArriving'), tone: 'arriving' as const }
        : { text: t('nativeBusDepartureMinutes', { count: viewedDeparture.minutes }), tone: 'ok' as const }
      : null;
  // 下車也以即時優先：那班的下車時刻是即時推算時顯示倒數，時刻表班次才顯示時刻
  const alightMinutes = viewed?.alightingTimeSource === 'realtime' ? minutesUntil(viewed.alightingTime, now) : null;
  const viewedAlightEta = alightMinutes === null ? null : { text: t('nativeBusDepartureMinutes', { count: alightMinutes }), tone: 'ok' as const };
  const boardClock = viewed ? formatRouteClock(viewed.boardingTime) ?? undefined : leg.departureTime;
  const alightClock = viewed ? formatRouteClock(viewed.alightingTime) ?? undefined : leg.arrivalTime;

  const renderEndpoint = (label: string, name: string, time: string | undefined, live: { text: string; tone: 'arriving' | 'ok' | 'normal' | 'muted' } | null) => {
    // 只顯示一種時間：有即時資訊就只放即時徽章，沒有才顯示時刻（「預定」只用在規劃的班次）
    const timeText = live ? live.text : time && viewingPlanned ? t('busPlannedAt', { time }) : time;
    return (
      <View accessible accessibilityLabel={[label, name, timeText].filter(Boolean).join(' ')} style={styles.endpoint}>
        <Text style={[styles.endpointLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.endpointName, { color: colors.text }]} numberOfLines={2}>
          {name}
        </Text>
        {live ? (
          <EtaPill text={live.text} tone={live.tone} />
        ) : time ? (
          <Text style={[styles.planned, { color: colors.textSecondary }]}>{time}</Text>
        ) : null}
      </View>
    );
  };
  const routeLiveEta = liveEta ? { text: t(liveEta.key, liveEta.params), tone: liveEta.tone } : null;
  const alightLive = resolveLiveEta(rows?.at(-1)?.estimateMinutes);

  return (
    <View style={styles.root}>
      {candidates.length > 0 ? (
        <BusDepartureChooser
          candidates={candidates}
          viewed={viewed}
          legColor={legColor}
          now={now}
          onView={(candidate) => {
            setView({ key, candidate });
            if (candidate.selected) return;
            // 地圖上的即時車輛是規劃那班的：查看別班時收起，免得地圖與時刻各說各話
            const store = useBusStore.getState();
            if (store.activeBusLeg?.key === key) store.setActiveBusLeg(null);
          }}
        />
      ) : (
        <View style={styles.badgeRow}>
          <View style={[styles.routeBadge, { backgroundColor: legColor }]}>
            <Text style={styles.routeBadgeText}>{busName(displayLeg.routeDisplayName, leg.routeName)}</Text>
          </View>
          {waitText ? <Text style={[styles.wait, { color: colors.textSecondary }]}>{t(waitText.key, waitText.params)}</Text> : null}
        </View>
      )}

      {viewingPlanned && expanded && targetBus?.plateNumb ? (
        <View
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={[t('busLiveTracking'), targetBus.plateNumb, currentStopLabel ? t('busCurrentStopAt', { stop: currentStopLabel }) : '']
            .filter(Boolean)
            .join(' ')}
          style={styles.live}>
          <View style={styles.liveDot} />
          <Text style={[styles.liveText, { color: colors.textSecondary }]}>{t('busLiveTracking')}</Text>
          <Text style={[styles.plate, { color: colors.text }]}>{targetBus.plateNumb}</Text>
          {currentStopLabel ? (
            <Text style={[styles.liveText, { color: colors.textSecondary }]}>{t('busCurrentStopAt', { stop: currentStopLabel })}</Text>
          ) : null}
        </View>
      ) : null}

      {renderEndpoint(
        t('board'),
        busName(rows?.[0]?.displayName, rows?.[0]?.name ?? busName(displayLeg.fromDisplayName, leg.departureStop)),
        boardClock,
        viewed ? viewedBoardEta : routeLiveEta,
      )}

      {other && !otherRide ? (
        <Text style={[styles.note, { color: colors.textSecondary }]}>
          {otherPending ? t('nativeBusViewedStopsLoading') : t('nativeBusViewedStopsUnavailable')}
        </Text>
      ) : stopCount > 0 ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('passStops', { count: stopCount })}
          accessibilityState={{ expanded: stopsOpen }}
          onPress={toggle}
          style={styles.toggle}>
          <Icon name={stopsOpen ? 'chevronUp' : 'chevronDown'} size={14} color={colors.textSecondary} />
          <Text style={[styles.toggleText, { color: colors.textSecondary }]}>{t('passStops', { count: stopCount })}</Text>
        </PressableScale>
      ) : null}

      {stopsOpen && (other ? Boolean(otherRide) : true) ? (
        <View style={[styles.stops, { borderColor: BUS_BORDER_COLOR }]}>
          {!other && status === 'error' && !hasRouteDetail ? (
            <Text style={[styles.note, { color: colors.textSecondary }]}>{t('busEtaError')}</Text>
          ) : null}
          {intermediateRows?.map((row) => (
            <StopRow
              key={row.stationUid || `${row.seq}-${row.name}`}
              row={row}
              legColor={legColor}
              isDark={isDark}
              plate={other ? undefined : targetBus?.plateNumb}
            />
          )) ??
            displayLeg.intermediateStops?.map((stop) => (
              <View key={stop.stationUid || stop.name} accessible accessibilityLabel={busName(stop.displayName, stop.name)} style={styles.stopRow}>
                <View style={[styles.dot, { backgroundColor: legColor }]} />
                <Text style={[styles.stopName, { color: colors.text }]}>{busName(stop.displayName, stop.name)}</Text>
              </View>
            ))}
        </View>
      ) : null}

      {renderEndpoint(
        t('alight'),
        busName(rows?.at(-1)?.displayName, rows?.at(-1)?.name ?? busName(displayLeg.toDisplayName, leg.arrivalStop)),
        alightClock,
        // 有候選班次時下車只放那班的抵達時刻：站序裡下車站的即時到站是「最近一班車」，不一定是這一台
        viewed ? viewedAlightEta : alightLive ? { text: t(alightLive.key, alightLive.params), tone: alightLive.tone } : null,
      )}

      {viewingPlanned && leg.nearestBus ? (
        <Text style={[styles.nearest, { color: pillToneStyle('ok', isDark).color }]}>
          {leg.nearestBus.stopsAway != null
            ? t('nearestBusStopsAway', { count: leg.nearestBus.stopsAway })
            : t('nearestBusApproaching')}
        </Text>
      ) : null}
    </View>
  );
}

function StopRow({ row, legColor, isDark, plate }: { row: BusLegStopRow; legColor: string; isDark: boolean; plate?: string }) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const label = resolveEtaLabel(row);
  const text = etaLabelText(t, label);
  const passed = row.state === 'passed';
  const current = row.state === 'current';
  const a11y = [busName(row.displayName, row.name), current && plate ? `${t('busLiveTracking')} ${plate}` : '', text ?? ''].filter(Boolean).join('，');
  return (
    <View accessible accessibilityLabel={a11y} style={styles.stopRow}>
      <View style={[styles.dot, current && styles.dotCurrent, { backgroundColor: passed ? BUS_BORDER_COLOR : legColor }]} />
      <View style={styles.stopTexts}>
        <Text
          style={[
            styles.stopName,
            { color: passed ? colors.textSecondary : colors.text },
            passed && styles.passed,
            current && styles.currentName,
          ]}>
          {busName(row.displayName, row.name)}
        </Text>
        {current && plate ? <Text style={[styles.plate, { color: colors.textSecondary }]}>{plate}</Text> : null}
      </View>
      {text ? (
        <EtaPill text={text} tone={etaTonePill(label.tone)} />
      ) : (
        <View style={[styles.skeleton, { backgroundColor: pillToneStyle('muted', isDark).surface }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  routeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: SHAPE.badge, borderCurve: 'continuous' },
  routeBadgeText: { color: BUS_ON_ACCENT_COLOR, fontSize: TYPE.footnote, fontWeight: '700' },
  wait: { fontSize: TYPE.footnote },
  live: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: SHAPE.pill, borderCurve: 'continuous', backgroundColor: LIVE_DOT },
  liveText: { fontSize: TYPE.caption },
  plate: { fontSize: TYPE.caption, fontWeight: '600', fontVariant: ['tabular-nums'] },
  endpoint: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  endpointLabel: { fontSize: TYPE.footnote },
  endpointName: { fontSize: TYPE.subhead, fontWeight: '600', flex: 1 },
  planned: { fontSize: TYPE.subhead, fontWeight: '600', fontVariant: ['tabular-nums'] },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 8, alignSelf: 'flex-start' },
  toggleText: { fontSize: TYPE.footnote },
  stops: { gap: 8, marginLeft: 12, paddingLeft: 12, borderLeftWidth: StyleSheet.hairlineWidth },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 },
  dot: { width: 8, height: 8, borderRadius: SHAPE.pill, borderCurve: 'continuous' },
  dotCurrent: { width: 12, height: 12, borderRadius: SHAPE.pill, borderCurve: 'continuous' },
  stopTexts: { flex: 1, gap: 2 },
  stopName: { fontSize: TYPE.subhead },
  passed: { textDecorationLine: 'line-through', opacity: 0.6 },
  currentName: { fontWeight: '700' },
  skeleton: { width: 44, height: 18, borderRadius: SHAPE.pill, borderCurve: 'continuous' },
  note: { fontSize: TYPE.footnote },
  nearest: { fontSize: TYPE.footnote },
});
