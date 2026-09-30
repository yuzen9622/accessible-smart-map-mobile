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

/**
 * 捷運膠囊的短名。後端的 `lineName` 常是「南港展覽館－亞東醫院」這種起訖站串，膠囊只剩「南港展覽館－亞東…」；
 * 起訖站串時：臺北捷運先換成大家認得的線名（BL → 板南線），其他短 `lineId` 直接用，都沒有就只留第一個站名。
 */
export function shortMetroLabel(lineName: string, lineId?: string, railSystem?: string): string {
  const name = lineName.trim();
  const isTerminusPair = /[－—–-]/.test(name) && name.length > 6;
  if (!isTerminusPair) return name;
  const id = lineId?.trim() ?? '';
  // 台北人認得「板南線」不一定認得「BL」。railSystem 實際值未定（Web 轉接層給的是泛用的 'metro'），
  // 所以預設套臺北捷運對照，只在明確是其他營運單位時跳過（高雄捷運的 R／O 是別條線）
  const otherSystem = !!railSystem && OTHER_METRO_SYSTEMS.test(railSystem);
  const taipeiName = !otherSystem && id ? TRTC_LINE_NAMES[id.replace(/^TRTC[-_]?/i, '')] : undefined;
  if (taipeiName) return taipeiName;
  if (id && id.length <= 6) return id;
  return name.split(/[－—–-]/)[0].trim() || name;
}

const OTHER_METRO_SYSTEMS = /KRTC|KLRT|TMRT|TYMC/i;

const TRTC_LINE_NAMES: Record<string, string> = {
  BL: '板南線',
  R: '淡水信義線',
  G: '松山新店線',
  O: '中和新蘆線',
  BR: '文湖線',
  Y: '環狀線',
};

export interface LegChainSegment {
  type: RouteLeg['type'];
  /** 運具上要印的短標籤：公車路線號、捷運線名、火車車次；步行與開車沒有。 */
  label?: string;
}

/**
 * 路線卡的運具串。連續的步行合併成一段（後端常把一次步行切成好幾個 WALK leg，卡片上就變成三個一樣的腳印），
 * 大眾運輸帶上路線號，讓「步行 › 🚌 28 › 步行」一眼看得出要搭什麼。
 */
export function legChainSegments(legs: readonly RouteLeg[]): LegChainSegment[] {
  const out: LegChainSegment[] = [];
  for (const leg of legs) {
    if (leg.type === 'WALK' && out.at(-1)?.type === 'WALK') continue;
    switch (leg.type) {
      case 'BUS':
        out.push({ type: leg.type, label: leg.routeName });
        break;
      case 'METRO':
        out.push({ type: leg.type, label: shortMetroLabel(leg.lineName, leg.lineId, leg.railSystem) });
        break;
      case 'THSR':
      case 'TRA':
        out.push({ type: leg.type, label: leg.trainNo });
        break;
      default:
        out.push({ type: leg.type });
    }
  }
  return out;
}

export interface RouteFacts {
  /** 階梯處數；後端沒有提供階梯資訊（沒有 a11ySegments 也沒有步驟）時為 null，不能當成 0。 */
  stairs: number | null;
  /** 步行段中最大的可信坡度百分比；沒有資料為 null。 */
  maxSlopePercent: number | null;
  elevators: number;
}

/**
 * 路線卡「理由」用的事實：階梯數、最大坡度、電梯數，只統計資料裡真的有的欄位。
 * 優先用 `a11ySegments`（pedestrian-a11y 引擎），沒有時退回步行步驟的 `stairs`／`ELEVATOR` 標記。
 */
export function routeFacts(route: AccessibleRoute): RouteFacts {
  let stairs = 0;
  let stairsKnown = false;
  let elevators = 0;
  let maxSlope: number | null = null;
  for (const leg of route.legs) {
    if (leg.type !== 'WALK') continue;
    let legHasStairs = false;
    if (leg.a11ySegments) {
      stairsKnown = true;
      for (const segment of leg.a11ySegments) {
        if (segment.feature === 'stairs') {
          stairs++;
          legHasStairs = true;
        } else if (segment.feature === 'elevator') {
          elevators++;
        }
      }
    } else if (leg.steps) {
      stairsKnown = true;
      for (const step of leg.steps) {
        if (step.stairs) {
          stairs++;
          legHasStairs = true;
        }
        if (step.relativeDirection === 'ELEVATOR') elevators++;
      }
    }
    const slope = plausibleSlopePercent(leg.maxSlopePercent, legHasStairs);
    if (slope !== null && (maxSlope === null || slope > maxSlope)) maxSlope = slope;
  }
  return { stairs: stairsKnown ? stairs : null, maxSlopePercent: maxSlope, elevators };
}
