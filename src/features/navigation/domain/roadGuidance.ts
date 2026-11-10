// 車行結構化道路指引（後端 DRIVING_NAVIGATION.md）：由「沿選定路線的進度」選出目前路段速限與下一個轉向的建議選道。
// 速限與車道都以 leg 原始 polyline 的索引對位，不用語音 step index，也不從指令文字推測。

import type { CumulativePath, NavInstruction, RoadLane, RouteLeg } from '@/features/route/domain';

import { isVehicleLegType } from './legMode';

/** 目前路段速限（HUD 與 `nav.state.speedLimit` 同一份）。 */
export type NavSpeedLimit =
  | { kind: 'known'; limitKph: number }
  | { kind: 'unlimited' | 'unknown'; limitKph: null };

/** 目前步驟（下一個轉向）的建議選道；`stepIndex` 是它所屬的指令。 */
export interface NavLaneGuidance {
  stepIndex: number;
  lanes: RoadLane[];
}

/** 在某個 leg 上的位置：`segmentIndex` 是該 leg 原始 polyline 的線段索引（頂點 i → i+1）。 */
export interface LegProgress {
  legIndex: number;
  segmentIndex: number;
}

/**
 * 串接路徑的線段索引 → leg-local 線段索引。leg 之間的接縫線段不屬於任何 leg，回傳 null（不宣稱目前段）。
 */
export function legProgressAt(path: Pick<CumulativePath, 'legRanges'>, pathSegmentIndex: number): LegProgress | null {
  if (!Number.isInteger(pathSegmentIndex) || pathSegmentIndex < 0) return null;
  for (let legIndex = 0; legIndex < path.legRanges.length; legIndex++) {
    const { start, count } = path.legRanges[legIndex];
    const segmentIndex = pathSegmentIndex - start;
    if (segmentIndex >= 0 && segmentIndex < count - 1) return { legIndex, segmentIndex };
  }
  return null;
}

const UNKNOWN: NavSpeedLimit = { kind: 'unknown', limitKph: null };

/**
 * 進度所在路段的速限。非車行 leg 或沒有進度回傳 null（不顯示、`nav.state` 省略）；
 * 車行 leg 上缺 `speedLimits`、`unavailable` 或該段沒有資料一律是 unknown，不沿用上一段。
 */
export function selectSpeedLimit(legs: readonly RouteLeg[], progress: LegProgress | null): NavSpeedLimit | null {
  if (!progress) return null;
  const leg = legs[progress.legIndex];
  if (!leg || (leg.type !== 'DRIVE' && leg.type !== 'MOTORCYCLE')) return null;
  const limits = leg.speedLimits;
  if (!limits || limits.status !== 'available') return UNKNOWN;
  const segment = limits.segments.find(
    (candidate) => candidate.fromIndex <= progress.segmentIndex && progress.segmentIndex < candidate.toIndex,
  );
  if (!segment) return UNKNOWN;
  if (segment.kind === 'unlimited') return { kind: 'unlimited', limitKph: null };
  if (segment.kind === 'known' && Number.isFinite(segment.limitKph) && segment.limitKph > 0) {
    return { kind: 'known', limitKph: Math.round(segment.limitKph) };
  }
  return UNKNOWN;
}

/**
 * 目前步驟（下一個轉向）的車道：進度落在它的 `laneApproachRange`（半開，`toIndex` 是轉向起點）才有；
 * 駛過轉向點、不在同一 leg、或缺 lanes／range 時回傳 null，HUD 保留一般轉向顯示。
 */
export function selectLaneGuidance(
  instructions: readonly NavInstruction[],
  stepIndex: number,
  progress: LegProgress | null,
): NavLaneGuidance | null {
  if (!progress) return null;
  const step = instructions[stepIndex];
  const guidance = step?.roadGuidance;
  const range = guidance?.laneApproachRange;
  if (!step || !guidance?.lanes?.length || !range || !isVehicleLegType(step.legType)) return null;
  if (step.legIndex !== progress.legIndex) return null;
  if (progress.segmentIndex < range.fromIndex || progress.segmentIndex >= range.toIndex) return null;
  return { stepIndex, lanes: guidance.lanes };
}

export function sameSpeedLimit(a: NavSpeedLimit | null, b: NavSpeedLimit | null): boolean {
  return a === b || (a != null && b != null && a.kind === b.kind && a.limitKph === b.limitKph);
}

export function sameLaneGuidance(a: NavLaneGuidance | null, b: NavLaneGuidance | null): boolean {
  return a === b || (a != null && b != null && a.stepIndex === b.stepIndex && a.lanes === b.lanes);
}

/**
 * 速限播報時機：目前段的 known 數值和上一個 known 數值不同才播（unknown／unlimited 不播，
 * 中間夾 unknown 不算改變；導航開始後第一個 known 只記下、不播）。回傳要播的數值或 null。
 */
export function speedLimitCueValue(previousKnownKph: number | null, current: NavSpeedLimit | null): number | null {
  if (current?.kind !== 'known' || previousKnownKph == null) return null;
  return current.limitKph === previousKnownKph ? null : current.limitKph;
}

/** VoiceOver 用：「4 條車道，建議走左起第 4 車道，左起第 3 車道也可以」。 */
export function laneAccessibilityParts(lanes: readonly RoadLane[]): { count: number; preferred: number[]; usable: number[] } {
  const preferred: number[] = [];
  const usable: number[] = [];
  lanes.forEach((lane, index) => {
    if (lane.recommendation === 'preferred') preferred.push(index + 1);
    else if (lane.recommendation === 'usable') usable.push(index + 1);
  });
  return { count: lanes.length, preferred, usable };
}
