import type { ReactNode } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

import { formatDistance } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';
import { useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import { filterIncidentsAlongRoute } from '../domain/geo';
import {
  A11Y_FEATURE_LABEL_KEY,
  driveLegMinutes,
  gradeSlope,
  gradeUnconfirmedCrossings,
  gradeWidth,
  shouldAppendExitNumber,
  walkA11yMetrics,
  walkStepText,
  type A11yGrade,
  type Translate,
} from '../domain/routeCard';
import { A11Y_FEATURE_COLOR, formatDuration, getLegColor, pointLabel } from '../domain/routeDisplay';
import { useRouteSessionStore } from '../store/routeSessionStore';
import type { DriveLeg, MatchedAlert, MetroAlert, RouteLeg, TrafficLevel, WalkLeg } from '../types/route';
import Disclosure from './Disclosure';
import { ROUTE_SURFACE_COLOR, ROUTE_WARN_SURFACE, routeStyles, routeTones, type RouteTones } from './palette';
import { LEG_ICON } from './RouteCard';

export interface LegDetailProps {
  leg: RouteLeg;
  /** 公車 leg 的站點／即時 ETA 由 bus feature 提供（route 不 import bus）；沒給時顯示靜態摘要。 */
  busStops?: ReactNode;
  engine?: 'pedestrian-a11y' | 'otp-fallback';
  /** 這段是整條路線的第一段／最後一段：只有這兩種情況，沒有名字的起／終點才退回使用者輸入的起訖名稱。 */
  isFirst?: boolean;
  isLast?: boolean;
}

const TRAFFIC_SUFFIX_KEY: Partial<Record<TrafficLevel, string>> = {
  moderate: 'trafficModerate',
  heavy: 'trafficHeavy',
  severe: 'trafficSevere',
  closed: 'trafficClosed',
};

function gradeColor(grade: A11yGrade, tones: RouteTones): string {
  return grade === 'good' ? tones.ok : grade === 'caution' ? tones.warn : tones.danger;
}

function legTitle(leg: RouteLeg, t: Translate): string {
  switch (leg.type) {
    case 'WALK':
      return t('walk');
    case 'BUS':
      return leg.subRouteName ?? leg.routeName;
    case 'METRO':
      return leg.lineName;
    case 'THSR':
      return `${t('thsr')} ${leg.trainNo}`;
    case 'TRA':
      return `${leg.trainTypeName}${leg.trainNo}`;
    case 'DRIVE':
    case 'MOTORCYCLE':
      return leg.label ?? (leg.type === 'DRIVE' ? t('drive') : t('motorcycle'));
  }
}

function Alerts({ alerts, tones }: { alerts: readonly (MatchedAlert | MetroAlert)[] | undefined; tones: RouteTones }) {
  const colors = useThemeColors();
  if (!alerts?.length) return null;
  return (
    <View style={styles.alerts}>
      {alerts.map((alert) => (
        <View key={alert.alertId} style={[routeStyles.card, styles.alertCard, { backgroundColor: ROUTE_WARN_SURFACE }]}>
          <Icon name="alert" size={14} color={tones.warn} />
          <View style={routeStyles.flex}>
            <Text style={[routeStyles.bodyText, { color: tones.warn }]}>{alert.title}</Text>
            {alert.description ? (
              <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>{alert.description}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function WalkDetail({ leg, engine, t, tones }: { leg: WalkLeg; engine?: string; t: Translate; tones: RouteTones }) {
  const colors = useThemeColors();
  const metrics = engine === 'pedestrian-a11y' ? walkA11yMetrics(leg) : null;
  const exit = leg.exitInfo;
  return (
    <>
      <Text style={[routeStyles.bodyText, { color: colors.text }]}>
        {`${formatDistance(leg.distanceM)} · ${t('approxTime', { time: formatDuration(leg.minutesEst) })}`}
      </Text>
      {exit ? (
        <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>
          {[
            exit.exitName,
            shouldAppendExitNumber(exit.exitName, exit.exitNumber) ? t('exitNumber', { number: exit.exitNumber }) : null,
            t(exit.type === 'elevator' ? 'elevator' : 'ramp'),
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      ) : null}
      {leg.a11yFacilities.length > 0 ? (
        <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>
          {t('a11yFacilitiesAlong', { count: leg.a11yFacilities.length })}
        </Text>
      ) : null}
      {metrics ? (
        <View style={styles.metrics}>
          {metrics.legend.length > 0 ? (
            <View style={routeStyles.chipsRow}>
              <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>{t('walkA11yAlong')}</Text>
              {metrics.legend.map((feature) => (
                <View key={feature} style={routeStyles.row}>
                  <View style={[styles.dot, { backgroundColor: A11Y_FEATURE_COLOR[feature] }]} />
                  <Text style={[routeStyles.metaText, { color: colors.text }]}>{t(A11Y_FEATURE_LABEL_KEY[feature])}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {metrics.slope != null ? (
            <Metric
              label={t('walkA11ySlopeLabel')}
              color={gradeColor(gradeSlope(metrics.slope), tones)}
              verdict={t(`slopeVerdict_${gradeSlope(metrics.slope)}`)}
              value={`${metrics.slope.toFixed(1)}%`}
            />
          ) : null}
          {metrics.width != null ? (
            <Metric
              label={t('walkA11yWidthLabel')}
              color={gradeColor(gradeWidth(metrics.width), tones)}
              verdict={t(`widthVerdict_${gradeWidth(metrics.width)}`)}
              value={t('widthCm', { width: metrics.width })}
            />
          ) : null}
          {metrics.unconfirmedCrossings != null && metrics.crossings != null ? (
            <Metric
              label={t('walkA11yCrossingLabel')}
              color={gradeColor(gradeUnconfirmedCrossings(metrics.unconfirmedCrossings), tones)}
              verdict={
                metrics.unconfirmedCrossings === 0
                  ? t('crossingAllRamped')
                  : t('crossingUnconfirmed', { count: metrics.unconfirmedCrossings, total: metrics.crossings })
              }
            />
          ) : null}
        </View>
      ) : null}
      {leg.steps?.length ? (
        <Disclosure label={t('viewWalkSteps')}>
          {leg.steps.map((step, index) => {
            const warnings = [step.stairs ? t('walkStepStairsWarning') : null, step.steepSlope ? t('walkStepSteepSlopeWarning') : null]
              .filter(Boolean)
              .join('、');
            const text = walkStepText(step, t);
            const color = step.stairs ? tones.danger : step.steepSlope ? tones.warn : colors.text;
            return (
              <View
                key={`${step.relativeDirection}-${step.distanceM}-${index}`}
                accessible
                accessibilityLabel={[text, warnings, formatDistance(step.distanceM)].filter(Boolean).join('，')}
                style={styles.step}>
                {warnings ? <Icon name="alert" size={14} color={color} /> : null}
                <Text style={[routeStyles.bodyText, routeStyles.flex, { color }]}>
                  {warnings ? `${text}（${warnings}）` : text}
                </Text>
                <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>{formatDistance(step.distanceM)}</Text>
              </View>
            );
          })}
        </Disclosure>
      ) : null}
    </>
  );
}

function Metric({ label, color, verdict, value }: { label: string; color: string; verdict: string; value?: string }) {
  const colors = useThemeColors();
  return (
    <View accessible accessibilityLabel={[label, verdict, value].filter(Boolean).join('，')} style={routeStyles.row}>
      <Text style={[routeStyles.metaText, styles.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[routeStyles.metaText, { color: colors.text }]}>{verdict}</Text>
      {value ? <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>{value}</Text> : null}
    </View>
  );
}

function DriveDetail({
  leg,
  t,
  tones,
  isFirst,
  isLast,
}: {
  leg: DriveLeg;
  t: Translate;
  tones: RouteTones;
  isFirst: boolean;
  isLast: boolean;
}) {
  const colors = useThemeColors();
  const suffixKey = leg.trafficLevel ? TRAFFIC_SUFFIX_KEY[leg.trafficLevel] : undefined;
  const incidents = filterIncidentsAlongRoute(leg.incidents, leg.polyline);
  const allRoadwork = incidents.length > 0 && incidents.every((i) => i.title.includes('施工') || /work/i.test(i.title));
  const originName = useRouteSessionStore((s) => s.originName);
  const destinationName = useRouteSessionStore((s) => s.destinationName);
  // 後端的開車 leg 起訖點是物件（見 pointLabel）；只有座標時退回使用者輸入的起訖名稱，兩端都沒有就不顯示這行。
  const endpoints = [pointLabel(leg.from, isFirst ? originName : ''), pointLabel(leg.to, isLast ? destinationName : '')]
    .filter(Boolean)
    .join(' → ');
  return (
    <>
      <Text style={[routeStyles.bodyText, { color: colors.text }]}>
        {`${formatDistance(leg.distanceM)} · ${t('approxTime', { time: formatDuration(driveLegMinutes(leg)) })}`}
        {suffixKey ? <Text style={{ color: leg.trafficLevel === 'moderate' ? tones.warn : tones.danger }}>{t(suffixKey)}</Text> : null}
      </Text>
      {endpoints ? <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>{endpoints}</Text> : null}
      {incidents.length > 0 ? (
        <Disclosure label={t(allRoadwork ? 'roadworkAlongRoute' : 'incidentsAlongRoute', { count: incidents.length })} color={tones.warn}>
          {incidents.map((incident) => (
            <View key={incident.incidentId} style={[routeStyles.card, styles.alertCard, { backgroundColor: ROUTE_WARN_SURFACE }]}>
              <Icon name={incident.severity === 'closure' ? 'alert' : 'construction'} size={14} color={tones.warn} />
              <View style={routeStyles.flex}>
                <Text style={[routeStyles.bodyText, { color: colors.text }]}>
                  {incident.severity === 'closure' ? `${incident.title}（${t('incidentClosure')}）` : incident.title}
                </Text>
                {incident.description ? (
                  <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>{incident.description}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </Disclosure>
      ) : null}
      {leg.steps?.length ? (
        <Disclosure label={t('viewDriveSteps')}>
          {leg.steps.map((step, index) => (
            <View key={`${step.instruction}-${index}`} style={styles.step}>
              <Text style={[routeStyles.bodyText, routeStyles.flex, { color: colors.text }]}>{step.instruction}</Text>
              <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>
                {`${formatDistance(step.distanceM)} · ${formatDuration(step.durationMin)}`}
              </Text>
            </View>
          ))}
        </Disclosure>
      ) : null}
    </>
  );
}

/**
 * 單段 leg 的明細（Web `LegDetail.tsx`）：步行（距離、出口、無障礙摘要、步驟）、公車（bus feature 注入）、
 * 捷運／高鐵／台鐵（起訖站、站數、時刻、設施亮點、營運公告）、開車（路況、沿線事件、步驟）。
 * 所有文字都是可讀的列表內容，這個畫面就是 SDD §10「路線文字步驟」的替代路徑。
 */
export default function LegDetail({ leg, busStops, engine, isFirst = false, isLast = false }: LegDetailProps) {
  const colors = useThemeColors();
  const tones = routeTones(useColorScheme() === 'dark');
  const { t } = useAppTranslation();
  const translate = t as Translate;

  return (
    <View style={[routeStyles.card, { backgroundColor: ROUTE_SURFACE_COLOR }]}>
      <View style={routeStyles.row}>
        <View style={[styles.legIcon, { backgroundColor: getLegColor(leg) }]}>
          <Icon name={LEG_ICON[leg.type]} size={16} color="#FFFFFF" />
        </View>
        <Text accessibilityRole="header" style={[routeStyles.sectionTitle, routeStyles.flex, { color: colors.text }]}>
          {legTitle(leg, translate)}
        </Text>
      </View>
      {leg.type === 'WALK' ? <WalkDetail leg={leg} engine={engine} t={translate} tones={tones} /> : null}
      {leg.type === 'BUS' ? (
        <>
          {busStops ?? (
            <Text style={[routeStyles.bodyText, { color: colors.text }]}>{`${leg.departureStop} → ${leg.arrivalStop}`}</Text>
          )}
          <Alerts alerts={leg.alerts} tones={tones} />
        </>
      ) : null}
      {leg.type === 'METRO' || leg.type === 'THSR' || leg.type === 'TRA' ? (
        <>
          <Text style={[routeStyles.bodyText, { color: colors.text }]}>
            {leg.departureTime && leg.arrivalTime
              ? `${leg.departureStation} ${leg.departureTime} → ${leg.arrivalStation} ${leg.arrivalTime}`
              : `${leg.departureStation} → ${leg.arrivalStation}`}
          </Text>
          <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>
            {[leg.type === 'METRO' ? t('stopsUnit', { count: leg.stopsCount }) : null, t('approxTime', { time: formatDuration(leg.rideMinutes) })]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {leg.facilityHighlights.map((highlight) => (
            <View key={highlight} style={routeStyles.row}>
              <Icon name="accessibility" size={14} color={tones.ok} />
              <Text style={[routeStyles.metaText, routeStyles.flex, { color: colors.text }]}>{highlight}</Text>
            </View>
          ))}
          <Alerts alerts={leg.alerts} tones={tones} />
        </>
      ) : null}
      {leg.type === 'DRIVE' || leg.type === 'MOTORCYCLE' ? <DriveDetail leg={leg} t={translate} tones={tones} isFirst={isFirst} isLast={isLast} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  legIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  metrics: { gap: 6 },
  metricLabel: { minWidth: 40 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  alerts: { gap: 6 },
  alertCard: { flexDirection: 'row', alignItems: 'flex-start' },
});
