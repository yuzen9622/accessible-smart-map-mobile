// LiveNavigationPort（SDD §4.3、§6.4）：驅動 iOS Live Activity／動態島與 Android 鎖定畫面常駐通知。
// Web 版沒有對應功能，這是新設計。本檔只放介面、快照組裝與節流判斷（純函式）；原生實作
// （Swift ActivityKit、Android 前景服務通知）在 Mac 上以 config plugin＋Expo module 完成。

import type { NavInstruction } from '@/features/route/domain';

import type { NavStepIconName } from './navStepIcon';

export interface LiveNavigationSnapshot {
  /** 下一步轉向圖示（與 HUD 同一套 Lucide 名稱）。 */
  icon: NavStepIconName;
  /** 下一步指示文字。 */
  instruction: string;
  /** 到下一個轉向點的距離（公尺）。 */
  distanceToNextM: number | null;
  /** 路線完成比例 0–1。 */
  progress: number | null;
  /** 預計抵達時間（epoch ms）。 */
  estimatedArrivalAt: number | null;
  remainingDurationSec: number | null;
  /** 偏航重算中：鎖定畫面必須改顯示「重新規劃路線中」，不得留著已失效的轉向（SDD §6.4 不變量）。 */
  rerouting: boolean;
}

export interface LiveNavigationPort {
  start(snapshot: LiveNavigationSnapshot): void;
  update(snapshot: LiveNavigationSnapshot): void;
  /** 抵達、手動結束、離開導航時呼叫；必須立即移除（iOS `dismissalPolicy: .immediate`）。 */
  end(): void;
}

export const noopLiveNavigation: LiveNavigationPort = { start: () => {}, update: () => {}, end: () => {} };

/** 距離變化小於這個值不重繪（GPS 飄移）。 */
export const LIVE_MIN_DISTANCE_DELTA_M = 10;
/** 兩次更新至少相隔（毫秒）。 */
export const LIVE_MIN_INTERVAL_MS = 2000;

export interface LiveThrottleState {
  lastSentAt: number;
  last: LiveNavigationSnapshot | null;
}

/**
 * 是否要把這個快照送給系統。ActivityKit 有更新預算，太頻繁會被系統節流、也耗電：
 * - 轉向（指示或圖示）變了、或重算狀態變了 → 立刻送（使用者要馬上看到新指示）；
 * - 否則距離變化 ≥ 10 m 且距上次 ≥ 2 秒才送；
 * - 否則不送。
 */
export function shouldSendLiveUpdate(state: LiveThrottleState, next: LiveNavigationSnapshot, now: number): boolean {
  const prev = state.last;
  if (!prev) return true;
  if (prev.instruction !== next.instruction || prev.icon !== next.icon || prev.rerouting !== next.rerouting) {
    return true;
  }
  if (now - state.lastSentAt < LIVE_MIN_INTERVAL_MS) return false;
  const before = prev.distanceToNextM;
  const after = next.distanceToNextM;
  if (before == null || after == null) return before !== after;
  return Math.abs(before - after) >= LIVE_MIN_DISTANCE_DELTA_M;
}

export interface LiveSnapshotInput {
  instructions: readonly NavInstruction[];
  currentStepIndex: number;
  distanceToNextM: number | null;
  remainingM: number | null;
  routeTotalM: number | null;
  estimatedArrivalAt: number | null;
  remainingDurationSec: number | null;
  rerouteStatus: 'idle' | 'pending' | 'error';
}

export function buildLiveSnapshot(input: LiveSnapshotInput, icon: (step: NavInstruction | undefined) => NavStepIconName): LiveNavigationSnapshot {
  const step = input.instructions[input.currentStepIndex];
  const progress =
    input.routeTotalM && input.routeTotalM > 0 && input.remainingM != null
      ? Math.min(1, Math.max(0, 1 - input.remainingM / input.routeTotalM))
      : null;
  return {
    icon: icon(step),
    instruction: step?.text ?? '',
    distanceToNextM: input.distanceToNextM,
    progress,
    estimatedArrivalAt: input.estimatedArrivalAt,
    remainingDurationSec: input.remainingDurationSec,
    rerouting: input.rerouteStatus === 'pending',
  };
}
