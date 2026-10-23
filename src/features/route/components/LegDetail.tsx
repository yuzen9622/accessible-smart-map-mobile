import { Text } from '@/shared/ui/typography/Text';
import type { ReactNode } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { formatDistance } from '@/shared/geo';
import { getAppLanguage, useAppTranslation } from '@/shared/i18n';
import { MAX_FONT_SCALE, TYPE, useSemanticColors, useThemeColors, WHITE, SHAPE, ICON_SIZE } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import { filterIncidentsAlongRoute, formatIncidentEnd, isIncidentClosed } from '../domain/geo';
import {
  A11Y_FEATURE_LABEL_KEY,
  driveLegMinutes,
  gradeSlope,
  localizedDuration,
  gradeUnconfirmedCrossings,
  gradeWidth,
  shouldAppendExitNumber,
  walkA11yMetrics,
  walkStepText,
  type A11yGrade,
  type Translate,
} from '../domain/routeCard';
import { A11Y_FEATURE_COLOR, formatDuration, getLegColor, pointLabel } from '../domain/routeDisplay';
import { nonEmptyName, presentRouteLegNames, walkStreetNames } from '../domain/routeNames';
import { useRouteSessionStore } from '../store/routeSessionStore';
import type { DriveLeg, MatchedAlert, MetroAlert, RouteLeg, TrafficLevel, WalkLeg, WalkRestPoint } from '../types/route';
import Disclosure from './Disclosure';
import { ROUTE_WARN_SURFACE, routeStyles, routeTones, type RouteTones } from './palette';
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
      return nonEmptyName(leg.routeDisplayName, nonEmptyName(leg.subRouteName, leg.routeName));
    case 'METRO':
      return nonEmptyName(leg.routeDisplayName, leg.lineName);
    case 'THSR':
      return `${nonEmptyName(leg.routeDisplayName, t('thsr'))} ${leg.trainNo}`;
    case 'TRA':
      return `${nonEmptyName(leg.routeDisplayName, leg.trainTypeName)}${leg.trainNo}`;
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
          <Icon name="alert" size={ICON_SIZE.caption} color={tones.warn} />
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

function WalkDetail({ leg, engine, t, tones, streetNames }: { leg: WalkLeg; engine?: string; t: Translate; tones: RouteTones; streetNames: string[] }) {
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
      {leg.restPoints?.length ? (
        <View accessible accessibilityLabel={restPointsText(leg.restPoints, t)} style={routeStyles.row}>
          <Icon name="check" size={ICON_SIZE.caption} color={tones.ok} />
          <Text style={[routeStyles.metaText, routeStyles.flex, { color: colors.text }]}>{restPointsText(leg.restPoints, t)}</Text>
        </View>
      ) : null}
      {leg.steps?.length ? (
        <Disclosure label={t('viewWalkSteps')}>
          {leg.steps.map((step, index) => {
            const warnings = [step.stairs ? t('walkStepStairsWarning') : null, step.steepSlope ? t('walkStepSteepSlopeWarning') : null]
              .filter(Boolean)
              .join('、');
            const text = walkStepText(step, t, streetNames[index]);
            const color = step.stairs ? tones.danger : step.steepSlope ? tones.warn : colors.text;
            return (
              <View
                key={`${step.relativeDirection}-${step.distanceM}-${index}`}
                accessible
                accessibilityLabel={[text, warnings, formatDistance(step.distanceM)].filter(Boolean).join('，')}
                style={styles.step}>
                {warnings ? <Icon name="alert" size={ICON_SIZE.caption} color={color} /> : null}
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

function restPointsText(points: WalkRestPoint[], t: (key: string, options?: Record<string, unknown>) => string): string {
  return points.map((p) => t('nativeWalkRestPoint', { distance: formatDistance(p.distanceM) })).join('、');
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
              <Icon name={isIncidentClosed(incident) ? 'alert' : 'construction'} size={ICON_SIZE.caption} color={tones.warn} />
              <View style={routeStyles.flex}>
                <Text style={[routeStyles.bodyText, { color: colors.text }]}>
                  {isIncidentClosed(incident) ? `${incident.title}（${t('incidentClosure')}）` : incident.title}
                </Text>
                {incident.locationDescription ?? incident.description ? (
                  <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>{incident.locationDescription ?? incident.description}</Text>
                ) : null}
                {formatIncidentEnd(incident.endTime) ? (
                  <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>
                    {t('incidentUntil', { date: formatIncidentEnd(incident.endTime) })}
                  </Text>
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

/** 步行段的點狀軌道：一串圓點由外層裁切，內容多高就露出多長（RN 的 dotted 邊框單邊在 iOS 不可靠）。 */
const DOTS = Array.from({ length: 400 }, (_, index) => index);

function TimelineRail({ leg, color }: { leg: RouteLeg; color: string }) {
  const semantic = useSemanticColors();
  const walk = leg.type === 'WALK';
  return (
    <View style={styles.rail} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={[styles.legIcon, walk ? { backgroundColor: semantic.neutral.bg } : { backgroundColor: color }]}>
        <Icon name={LEG_ICON[leg.type]} size={ICON_SIZE.body} color={walk ? semantic.neutral.fg : WHITE} />
      </View>
      {walk ? (
        // 絕對定位：點串本身很長，若參與排版會把整段撐高；只填滿內容決定的高度
        <View style={styles.dotsTrack}>
          <View style={styles.dots}>
            {DOTS.map((dot) => (
              <View key={dot} style={[styles.railDot, { backgroundColor: semantic.neutral.fg }]} />
            ))}
          </View>
        </View>
      ) : (
        <View style={[styles.line, { backgroundColor: color }]} />
      )}
    </View>
  );
}

function legMinutes(leg: RouteLeg): number | null {
  switch (leg.type) {
    case 'WALK':
      return leg.minutesEst;
    case 'DRIVE':
    case 'MOTORCYCLE':
      return driveLegMinutes(leg);
    case 'BUS':
      return leg.rideMinutes ?? null;
    default:
      return leg.rideMinutes;
  }
}

/**
 * 單段 leg 的明細（Web `LegDetail.tsx`），排成路線時間軸的一節（Google Maps 的大眾運輸詳情）：
 * 左側軌道（運具圖示＋依運具上色的線，步行是點狀線），右側標題、時長與內容——
 * 步行（距離、出口、無障礙摘要、步驟）、公車（bus feature 注入，含可搭乘的班次）、
 * 捷運／高鐵／台鐵（起訖站、站數、時刻、設施亮點、營運公告）、開車（路況、沿線事件、步驟）。
 * 所有文字都是可讀的列表內容，這個畫面就是 SDD §10「路線文字步驟」的替代路徑。
 */
export default function LegDetail({ leg: originalLeg, busStops, engine, isFirst = false, isLast = false }: LegDetailProps) {
  const colors = useThemeColors();
  const tones = routeTones(useColorScheme() === 'dark');
  const { t } = useAppTranslation();
  const translate = t as Translate;
  const leg = presentRouteLegNames(originalLeg, getAppLanguage());
  const minutes = legMinutes(leg);

  return (
    <View style={styles.segment}>
      <TimelineRail leg={leg} color={getLegColor(leg)} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]} maxFontSizeMultiplier={MAX_FONT_SCALE.heading}>
            {leg.type === 'BUS' ? t('railBus') : legTitle(leg, translate)}
          </Text>
          {minutes !== null && leg.type !== 'WALK' ? (
            <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>{localizedDuration(minutes, translate)}</Text>
          ) : null}
        </View>
        {leg.type === 'WALK' && originalLeg.type === 'WALK' ? (
          <WalkDetail leg={leg} engine={engine} t={translate} tones={tones} streetNames={walkStreetNames(originalLeg, getAppLanguage())} />
        ) : null}
        {leg.type === 'BUS' ? (
          <>
            {busStops ?? (
              <Text style={[routeStyles.bodyText, { color: colors.text }]}>{`${nonEmptyName(leg.fromDisplayName, leg.departureStop)} → ${nonEmptyName(leg.toDisplayName, leg.arrivalStop)}`}</Text>
            )}
            <Alerts alerts={leg.alerts} tones={tones} />
          </>
        ) : null}
        {leg.type === 'METRO' || leg.type === 'THSR' || leg.type === 'TRA' ? (
          <>
            <Text style={[routeStyles.bodyText, { color: colors.text }]}>
              {leg.departureTime && leg.arrivalTime
                ? `${nonEmptyName(leg.fromDisplayName, leg.departureStation)} ${leg.departureTime} → ${nonEmptyName(leg.toDisplayName, leg.arrivalStation)} ${leg.arrivalTime}`
                : `${nonEmptyName(leg.fromDisplayName, leg.departureStation)} → ${nonEmptyName(leg.toDisplayName, leg.arrivalStation)}`}
            </Text>
            <Text style={[routeStyles.metaText, { color: colors.textSecondary }]}>
              {[leg.type === 'METRO' ? t('stopsUnit', { count: leg.stopsCount }) : null, t('approxTime', { time: formatDuration(leg.rideMinutes) })]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {leg.facilityHighlights.map((highlight) => (
              <View key={highlight} style={routeStyles.row}>
                <Icon name="accessibility" size={ICON_SIZE.caption} color={tones.ok} />
                <Text style={[routeStyles.metaText, routeStyles.flex, { color: colors.text }]}>{highlight}</Text>
              </View>
            ))}
            <Alerts alerts={leg.alerts} tones={tones} />
          </>
        ) : null}
        {leg.type === 'DRIVE' || leg.type === 'MOTORCYCLE' ? <DriveDetail leg={leg} t={translate} tones={tones} isFirst={isFirst} isLast={isLast} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', gap: 12 },
  rail: { width: 32, alignItems: 'center' },
  legIcon: { width: 32, height: 32, borderRadius: SHAPE.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 5, borderRadius: SHAPE.pill, borderCurve: 'continuous', marginVertical: 4 },
  dotsTrack: { flex: 1, alignSelf: 'stretch' },
  dots: { position: 'absolute', top: 6, bottom: 4, left: 0, right: 0, overflow: 'hidden', alignItems: 'center' },
  railDot: { marginBottom: 5, width: 5, height: 5, borderRadius: SHAPE.pill, borderCurve: 'continuous' },
  body: { flex: 1, gap: 8, paddingTop: 5, paddingBottom: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: TYPE.body + 1, fontWeight: '700', flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: SHAPE.pill, borderCurve: 'continuous' },
  metrics: { gap: 6 },
  metricLabel: { minWidth: 40 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  alerts: { gap: 6 },
  alertCard: { flexDirection: 'row', alignItems: 'flex-start' },
});
