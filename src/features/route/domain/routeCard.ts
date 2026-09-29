// 移植自 Web `src/components/shared/RouteCard/utils.ts`、`RouteCard.tsx` 的 routeSummary、
// `WalkStepsList.tsx` 的 useStepText（commit 5eadc71），邏輯逐行保留。
// Web 把這些寫在元件檔旁；本 repo 放 domain 讓 jest 在 node 下測，翻譯函式由呼叫端注入。

import { plausibleSlopePercent } from './routeDisplay';
import type {
  A11yFeature,
  AccessibleRoute,
  RouteLeg,
  SlimOsmA11y,
  WalkAbsoluteDirection,
  WalkLeg,
  WalkRelativeDirection,
  WalkStep,
} from '../types/route';

/** i18next `t` 的最小形狀；domain 不依賴 i18n 實例。 */
export type Translate = (key: string, options?: Record<string, unknown>) => string;

// exitName 可能已經寫出出口編號（例："2號出口"），再附加會變成「2號出口 (2 號出口)」。
// 單純 `.includes()` 會在「12號出口」含 "2" 時誤判，所以要求編號不是更長數字／字母串的一部分。
export function shouldAppendExitNumber(exitName: string | undefined, exitNumber: string | undefined): boolean {
  if (!exitNumber) return false;
  if (!exitName) return true;
  const escaped = exitNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?<![0-9A-Za-z])${escaped}(?![0-9A-Za-z])`);
  return !pattern.test(exitName);
}

const CONFIDENCE_LABEL_KEY: Record<NonNullable<AccessibleRoute['dataConfidence']>, string> = {
  high: 'confidenceHigh',
  medium: 'confidenceMedium',
  low: 'confidenceLow',
};

export function getConfidenceLabelKey(confidence: AccessibleRoute['dataConfidence']): string | null {
  return confidence ? (CONFIDENCE_LABEL_KEY[confidence] ?? null) : null;
}

function countAlerts(alerts: readonly unknown[], seen: Set<string>): number {
  let count = 0;
  for (const alert of alerts) {
    if (!alert || typeof alert !== 'object') continue;
    const id = (alert as { alertId?: unknown }).alertId;
    if (typeof id === 'string' && id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    count++;
  }
  return count;
}

/** leg 內與路線頂層 `transitAlerts` 的警示總數，同 `alertId` 只算一次。 */
export function getRouteAlertsCount(route: AccessibleRoute): number {
  if (!route?.legs) return 0;
  const seen = new Set<string>();
  let count = 0;
  for (const leg of route.legs) {
    if ('alerts' in leg && Array.isArray(leg.alerts)) count += countAlerts(leg.alerts, seen);
  }
  if (Array.isArray(route.transitAlerts)) count += countAlerts(route.transitAlerts, seen);
  return count;
}

/** 依首次出現順序去重的無障礙設施類別（每類畫一個圖示，不是每個設施一個）。 */
export function dedupeA11yCategories(items: SlimOsmA11y[] | undefined): SlimOsmA11y['category'][] {
  if (!items?.length) return [];
  const seen = new Set<SlimOsmA11y['category']>();
  const out: SlimOsmA11y['category'][] = [];
  for (const item of items) {
    if (!seen.has(item.category)) {
      seen.add(item.category);
      out.push(item.category);
    }
  }
  return out;
}

export const LABEL_TO_SCORE: Record<string, number> = {
  excellent: 90,
  good: 70,
  fair: 50,
  poor: 30,
  critical: 10,
};

/** 路線卡星等用的分數：優先 `accessibilityScore`，否則由 label 推估；兩者都沒有回傳 null。 */
export function effectiveAccessibilityScore(route: AccessibleRoute): number | null {
  if (typeof route.accessibilityScore === 'number' && Number.isFinite(route.accessibilityScore)) {
    return route.accessibilityScore;
  }
  return route.accessibilityLabel ? (LABEL_TO_SCORE[route.accessibilityLabel] ?? null) : null;
}

/** 路線卡副標：非步行 leg 的名稱以「 → 」串接。 */
export function routeSummary(legs: readonly RouteLeg[], t: Translate): string {
  return legs
    .filter((leg) => leg.type !== 'WALK')
    .map((leg) => {
      switch (leg.type) {
        case 'BUS':
          return leg.routeName;
        case 'METRO':
          return leg.lineName;
        case 'THSR':
          return `${t('thsr')} ${leg.trainNo}`;
        case 'TRA':
          return `${leg.trainTypeName}${leg.trainNo}`;
        case 'DRIVE':
        case 'MOTORCYCLE':
          return leg.label ?? (leg.type === 'DRIVE' ? t('drive') : t('motorcycle'));
        default:
          return '';
      }
    })
    .join(' → ');
}

const DIRECTION_KEY = {
  DEPART: 'walkDirDepart',
  CONTINUE: 'walkDirContinue',
  STRAIGHT: 'walkDirStraight',
  LEFT: 'walkDirLeft',
  RIGHT: 'walkDirRight',
  SLIGHTLY_LEFT: 'walkDirSlightlyLeft',
  SLIGHTLY_RIGHT: 'walkDirSlightlyRight',
  HARD_LEFT: 'walkDirHardLeft',
  HARD_RIGHT: 'walkDirHardRight',
  UTURN_LEFT: 'walkDirUturnLeft',
  UTURN_RIGHT: 'walkDirUturnRight',
  CIRCLE_CLOCKWISE: 'walkDirCircleClockwise',
  CIRCLE_COUNTERCLOCKWISE: 'walkDirCircleCounterclockwise',
  ELEVATOR: 'walkDirElevator',
  ESCALATOR: 'walkDirEscalator',
  MOVING_WALKWAY: 'walkDirMovingWalkway',
  FARE_GATE: 'walkDirFareGate',
  ENTER_STATION: 'walkDirEnterStation',
  EXIT_STATION: 'walkDirExitStation',
} satisfies Record<WalkRelativeDirection, string>;

const ABSOLUTE_DIRECTION_KEY = {
  NORTH: 'walkDirNorth',
  NORTHEAST: 'walkDirNortheast',
  EAST: 'walkDirEast',
  SOUTHEAST: 'walkDirSoutheast',
  SOUTH: 'walkDirSouth',
  SOUTHWEST: 'walkDirSouthwest',
  WEST: 'walkDirWest',
  NORTHWEST: 'walkDirNorthwest',
} satisfies Record<WalkAbsoluteDirection, string>;

// 設施是地點，不是方向——黏上街名會描述一個不存在的轉彎。
const FACILITY_DIRECTIONS = new Set<WalkRelativeDirection>([
  'ELEVATOR',
  'ESCALATOR',
  'MOVING_WALKWAY',
  'FARE_GATE',
  'ENTER_STATION',
  'EXIT_STATION',
]);

const ALONG_DIRECTIONS = new Set<WalkRelativeDirection>(['DEPART', 'CONTINUE', 'STRAIGHT']);

/** 步行步驟的顯示文字（Web `WalkStepsList` 的 useStepText）。 */
export function walkStepText(step: WalkStep, t: Translate): string {
  const action = t(DIRECTION_KEY[step.relativeDirection]);
  const street = step.bogusName ? '' : step.streetName.trim();
  const text =
    !street || FACILITY_DIRECTIONS.has(step.relativeDirection)
      ? action
      : t(step.area || !ALONG_DIRECTIONS.has(step.relativeDirection) ? 'walkStepInto' : 'walkStepAlong', {
          street,
          action,
        });
  return step.absoluteDirection ? `${text} · ${t(ABSOLUTE_DIRECTION_KEY[step.absoluteDirection])}` : text;
}

/** 開車 leg 顯示的時間：有路況時間優先（Web `LegDetail.tsx`）。 */
export function driveLegMinutes(leg: Extract<RouteLeg, { type: 'DRIVE' | 'MOTORCYCLE' }>): number {
  return leg.durationInTrafficMin ?? leg.durationMin ?? leg.durationMinutes ?? 0;
}

// --- 步行無障礙摘要（Web `WalkA11ySummary.tsx`） ---

export type A11yGrade = 'good' | 'caution' | 'bad';

// 建築物無障礙設施設計規範：坡道不得超過 1:12（8.33%）。
export function gradeSlope(percent: number): A11yGrade {
  if (percent <= 5) return 'good';
  return percent <= 8.33 ? 'caution' : 'bad';
}

// 建築物無障礙設施設計規範：通行淨寬 90 cm、迴轉 150 cm。
export function gradeWidth(cm: number): A11yGrade {
  if (cm >= 150) return 'good';
  return cm >= 90 ? 'caution' : 'bad';
}

export function gradeUnconfirmedCrossings(count: number): A11yGrade {
  if (count === 0) return 'good';
  return count <= 2 ? 'caution' : 'bad';
}

/** 圖例順序：會擋住輪椅的先念。 */
export const A11Y_FEATURE_ORDER: readonly A11yFeature[] = [
  'stairs',
  'crossing',
  'curb_ramp_crossing',
  'ramp',
  'elevator',
  'escalator',
  'moving_walkway',
  'fare_gate',
  'exit_gate',
];

export const A11Y_FEATURE_LABEL_KEY: Record<A11yFeature, string> = {
  stairs: 'a11yFeatureStairs',
  crossing: 'a11yFeatureCrossing',
  curb_ramp_crossing: 'a11yFeatureCurbRampCrossing',
  ramp: 'a11yFeatureRamp',
  elevator: 'a11yFeatureElevator',
  escalator: 'a11yFeatureEscalator',
  moving_walkway: 'a11yFeatureMovingWalkway',
  fare_gate: 'a11yFeatureFareGate',
  exit_gate: 'a11yFeatureExitGate',
};

export interface WalkA11yMetrics {
  legend: A11yFeature[];
  slope: number | null;
  width: number | null;
  /** 未確認有路緣坡道的路口數。0 代表「沒觀測到」而不是「沒有坡道」，文案只能說「未確認」。 */
  unconfirmedCrossings: number | null;
  crossings: number | null;
}

export function walkA11yMetrics(leg: WalkLeg): WalkA11yMetrics | null {
  const present = new Set(leg.a11ySegments?.map((s) => s.feature));
  const legend = A11Y_FEATURE_ORDER.filter((f) => present.has(f));
  const slope = plausibleSlopePercent(leg.maxSlopePercent, present.has('stairs'));
  const width = leg.minPathWidthCm ?? null;
  const unconfirmed =
    leg.crossings != null && leg.crossingsWithCurbRamp != null ? leg.crossings - leg.crossingsWithCurbRamp : null;
  if (!legend.length && slope == null && width == null && unconfirmed == null) return null;
  return { legend, slope, width, unconfirmedCrossings: unconfirmed, crossings: leg.crossings ?? null };
}
