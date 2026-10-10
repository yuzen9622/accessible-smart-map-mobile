import { Text } from '@/shared/ui/typography/Text';
import { useMemo } from "react";
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { getLegColor, type AccessibleRoute, type BusLeg } from '@/features/route/domain';
import { useAppTranslation } from '@/shared/i18n';
import { useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import {
  buildStopRows,
  fallbackStopRows,
  resolveCurrentStopSeq,
  resolveEtaLabel,
  resolveLegStops,
  resolveLiveEta,
  resolveWaitText,
  type BusLegStopRow,
} from '../domain';
import { useBusLegStopEtas } from '../hooks/useBusLegStopEtas';
import { busLegKey, useBusStore } from '../store/busStore';
import { etaLabelText, etaTonePill } from './busText';
import EtaPill from './EtaPill';
import { BUS_BORDER_COLOR, BUS_ON_ACCENT_COLOR, pillToneStyle } from './palette';

export interface BusLegStopsProps {
  route: AccessibleRoute;
  routeIndex: number;
  legIndex: number;
  leg: BusLeg;
}

/**
 * 路線詳情裡的公車 leg（對齊 Web `LegDetail` 的 BUS 分支＋`BusLegStops`／`TransitStops`，commit 5eadc71）：
 * 路線徽章、等候徽章、上車／下車列與可展開的中途站。展開才把這段 leg 設成 `activeBusLeg`
 * （啟動即時車輛與逐站 ETA 輪詢）；收合時只有這段仍是 active 才清掉，避免蓋掉別段的展開。
 */
export default function BusLegStops({ route, routeIndex, legIndex, leg: rawLeg }: BusLegStopsProps) {
  const { t } = useAppTranslation();
  const leg = useMemo(() => ({ ...rawLeg, planContext: route.routeToken ? { routeToken: route.routeToken, legIndex } : undefined }), [rawLeg, route.routeToken, legIndex]);
  const colors = useThemeColors();
  const isDark = useColorScheme() === 'dark';
  const key = busLegKey(route, routeIndex, legIndex, leg);
  const expanded = useBusStore((s) => s.activeBusLeg?.key === key);
  const liveBuses = useBusStore((s) => s.liveBusPositions);
  const { directions, status } = useBusLegStopEtas(leg, true, expanded);

  const targetBus = liveBuses.find((b) => b.isTarget) ?? null;
  const legColor = getLegColor(leg);

  let rows: BusLegStopRow[] | undefined;
  let hasRouteDetail = false;
  if (expanded) {
    const sliced = resolveLegStops(directions ?? undefined, leg);
    hasRouteDetail = Boolean(sliced && sliced.length > 0);
    rows =
      sliced && sliced.length > 0
        ? buildStopRows(sliced, resolveCurrentStopSeq(sliced, targetBus))
        : fallbackStopRows(leg, { pending: status === 'idle' || status === 'loading' });
  }
  const intermediateRows = rows && rows.length > 2 ? rows.slice(1, -1) : undefined;
  const currentStopName = rows?.find((r) => r.state === 'current')?.name;
  const stopCount = intermediateRows?.length ?? leg.intermediateStops?.length ?? 0;

  const toggle = () => {
    const store = useBusStore.getState();
    if (expanded) {
      if (store.activeBusLeg?.key === key) store.setActiveBusLeg(null);
    } else {
      store.setActiveBusLeg({ key, leg, route });
    }
  };

  const waitText = resolveWaitText(leg.waitInfo);
  const liveEta = expanded ? resolveLiveEta(rows?.[0]?.estimateMinutes) : null;

  const renderEndpoint = (label: string, name: string, plannedTime: string | undefined, live: typeof liveEta) => {
    const liveText = live ? t(live.key, live.params) : null;
    const planned = plannedTime ? t('busPlannedAt', { time: plannedTime }) : null;
    return (
      <View
        accessible
        accessibilityLabel={[label, name, liveText ?? planned].filter(Boolean).join(' ')}
        style={styles.endpoint}>
        <Text style={[styles.endpointLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.endpointName, { color: colors.text }]}>{name}</Text>
        {live && liveText ? (
          <EtaPill text={liveText} tone={live.tone} />
        ) : planned ? (
          <Text style={[styles.planned, { color: colors.textSecondary }]}>{planned}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.badgeRow}>
        <View style={[styles.routeBadge, { backgroundColor: legColor }]}>
          <Text style={styles.routeBadgeText}>{leg.routeName}</Text>
        </View>
        {waitText ? <Text style={[styles.wait, { color: colors.textSecondary }]}>{t(waitText.key, waitText.params)}</Text> : null}
      </View>

      {expanded && targetBus?.plateNumb ? (
        <View
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={[t('busLiveTracking'), targetBus.plateNumb, currentStopName ? t('busCurrentStopAt', { stop: currentStopName }) : '']
            .filter(Boolean)
            .join(' ')}
          style={styles.live}>
          <View style={styles.liveDot} />
          <Text style={[styles.liveText, { color: colors.textSecondary }]}>{t('busLiveTracking')}</Text>
          <Text style={[styles.plate, { color: colors.text }]}>{targetBus.plateNumb}</Text>
          {currentStopName ? (
            <Text style={[styles.liveText, { color: colors.textSecondary }]}>{t('busCurrentStopAt', { stop: currentStopName })}</Text>
          ) : null}
        </View>
      ) : null}

      {renderEndpoint(t('board'), leg.departureStop, leg.departureTime, liveEta)}

      {stopCount > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('passStops', { count: stopCount })}
          accessibilityState={{ expanded }}
          onPress={toggle}
          style={styles.toggle}>
          <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={14} color={colors.textSecondary} />
          <Text style={[styles.toggleText, { color: colors.textSecondary }]}>{t('passStops', { count: stopCount })}</Text>
        </Pressable>
      ) : null}

      {expanded ? (
        <View style={[styles.stops, { borderColor: BUS_BORDER_COLOR }]}>
          {status === 'error' && !hasRouteDetail ? (
            <Text style={[styles.note, { color: colors.textSecondary }]}>{t('busEtaError')}</Text>
          ) : null}
          {intermediateRows?.map((row) => (
            <StopRow
              key={row.stationUid || `${row.seq}-${row.name}`}
              row={row}
              legColor={legColor}
              isDark={isDark}
              plate={targetBus?.plateNumb}
            />
          )) ??
            leg.intermediateStops?.map((stop) => (
              <View key={stop.stationUid || stop.name} accessible accessibilityLabel={stop.name} style={styles.stopRow}>
                <View style={[styles.dot, { backgroundColor: legColor }]} />
                <Text style={[styles.stopName, { color: colors.text }]}>{stop.name}</Text>
              </View>
            ))}
        </View>
      ) : null}

      {renderEndpoint(t('alight'), leg.arrivalStop, leg.arrivalTime, expanded ? resolveLiveEta(rows?.at(-1)?.estimateMinutes) : null)}

      {leg.nearestBus ? (
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
  const a11y = [row.name, current && plate ? `${t('busLiveTracking')} ${plate}` : '', text ?? ''].filter(Boolean).join('，');
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
          {row.name}
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
  root: { gap: 6 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  routeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  routeBadgeText: { color: BUS_ON_ACCENT_COLOR, fontSize: 13, fontWeight: '700' },
  wait: { fontSize: 13 },
  live: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  liveText: { fontSize: 12 },
  plate: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  endpoint: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, minHeight: 32 },
  endpointLabel: { fontSize: 13 },
  endpointName: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  planned: { fontSize: 13, marginLeft: 'auto' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 8, alignSelf: 'flex-start' },
  toggleText: { fontSize: 13 },
  stops: { gap: 8, marginLeft: 12, paddingLeft: 12, borderLeftWidth: StyleSheet.hairlineWidth },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotCurrent: { width: 12, height: 12, borderRadius: 6 },
  stopTexts: { flex: 1, gap: 2 },
  stopName: { fontSize: 14 },
  passed: { textDecorationLine: 'line-through', opacity: 0.6 },
  currentName: { fontWeight: '700' },
  skeleton: { width: 44, height: 18, borderRadius: 9 },
  note: { fontSize: 13 },
  nearest: { fontSize: 13 },
});
