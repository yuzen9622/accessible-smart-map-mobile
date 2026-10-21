// 轉向播報分段（對齊 Google／Apple Maps）：一個轉向點最多念三次——
// 1. `advance`：這一步成為目前步驟時（上一個轉彎剛完成）念「X 公尺後，向左轉」；
// 2. `prepare`：快到時再提醒一次「50 公尺後，向左轉」（advance 已經很近就不重複）；
// 3. `now`：到轉向點時念「向左轉…」。
// 步驟要等使用者真的越過轉向點才推進（見 `legMode.selectNextStepIndex`），所以不會在轉彎前念下一步。
// `maneuver` 為 CONTINUE／STRAIGHT 的步驟不是轉向點，只在 `now` 念一次（不念「X 公尺後，繼續直行」）。
// 後端不切長直線，一條路只有一步；步行時由 `selectProgressReminder` 在剩餘距離跨過每個 500 公尺整數點時念「繼續直行 N」。

import type { NavInstruction } from '@/features/route/domain';

import { isVehicleLegType, type NavLegType } from './legMode';

export type ManeuverStage = 'advance' | 'prepare' | 'now';

export interface AnnouncementThresholds {
  /** 剩這個距離內再提醒一次。 */
  prepareM: number;
  /** 剩這個距離內念「現在轉」。 */
  nowM: number;
}

export const WALK_ANNOUNCE: AnnouncementThresholds = { prepareM: 50, nowM: 12 };
export const VEHICLE_ANNOUNCE: AnnouncementThresholds = { prepareM: 300, nowM: 50 };

export function announceThresholdsFor(legType: NavLegType | null | undefined): AnnouncementThresholds {
  return isVehicleLegType(legType) ? VEHICLE_ANNOUNCE : WALK_ANNOUNCE;
}

/** 後端明確標示為沿路直行。缺欄位或 null 一律回 false，維持舊行為。 */
export function isStraightManeuver(step: Pick<NavInstruction, 'maneuver'>): boolean {
  return step.maneuver === 'CONTINUE' || step.maneuver === 'STRAIGHT';
}

/**
 * 這個距離該念哪一段；不用念回傳 null。
 * @param spoken 這一步已念過的段落。
 * @param advanceDistanceM 念 `advance` 時的距離；離 `prepareM` 不夠遠時不再念 `prepare`，避免連續重複。
 * @param straight 直行步驟（見 `isStraightManeuver`）：不預告，只回 `now`。
 */
export function selectManeuverStage(
  distanceM: number,
  legType: NavLegType | null | undefined,
  spoken: ReadonlySet<ManeuverStage>,
  advanceDistanceM: number | null,
  straight = false,
): ManeuverStage | null {
  if (spoken.has('now')) return null;
  const { prepareM, nowM } = announceThresholdsFor(legType);
  if (distanceM <= nowM) return 'now';
  if (straight) return null;
  if (spoken.size === 0) return 'advance';
  if (!spoken.has('prepare') && distanceM <= prepareM && advanceDistanceM != null && advanceDistanceM > prepareM * 1.5) {
    return 'prepare';
  }
  return null;
}

/** 步行長直線的進度提醒間隔：剩餘距離每跨過一個整數倍念一次。 */
export const WALK_REMINDER_INTERVAL_M = 500;
/** 這一步開始後至少走這麼遠才提醒，避免緊接在 advance 後重複報距離。 */
const REMINDER_MIN_WALKED_M = 150;

/**
 * 步行長直線該念的進度點（公尺）；不用念回傳 null。
 * @param spokenMarks 這一步已念過的進度點。
 * @param startDistanceM 這一步成為目前步驟時的距離。
 */
export function selectProgressReminder(
  distanceM: number,
  legType: NavLegType | null | undefined,
  spokenMarks: ReadonlySet<number>,
  startDistanceM: number | null,
): number | null {
  if (legType !== 'WALK' || startDistanceM == null || distanceM <= WALK_ANNOUNCE.prepareM) return null;
  const mark = Math.ceil(distanceM / WALK_REMINDER_INTERVAL_M) * WALK_REMINDER_INTERVAL_M;
  if (spokenMarks.has(mark) || startDistanceM - mark < REMINDER_MIN_WALKED_M) return null;
  return mark;
}

/** 播報用的距離：10 公尺為單位（GPS 沒有更細的精度），1 公里以上取到 0.1 公里。 */
export function spokenDistance(meters: number): { unit: 'm'; value: number } | { unit: 'km'; value: number } {
  if (meters >= 1000) return { unit: 'km', value: Math.round(meters / 100) / 10 };
  return { unit: 'm', value: Math.max(10, Math.round(meters / 10) * 10) };
}
