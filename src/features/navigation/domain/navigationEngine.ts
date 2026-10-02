// 導航引擎（SDD §6.4）：把 Web `src/hook/useNavigation.ts`（commit 5eadc71）裡「位置 → 進度／偏航／抵達」
// 的判斷從 React effect 抽成純函式。Web 在 effect 裡直接讀寫 store 與 ref；這裡改成
// 「輸入目前狀態 → 回傳要套用的變化」，由 `controller/navigationController.ts` 套用副作用
// （寫 store、叫重算協調器、播報）。常數與判斷順序逐條對齊 Web。

import { projectToPath, type CumulativePath, type NavInstruction, type Waypoint } from '@/features/route/domain';
import { haversineMeters, type LatLng } from '@/shared/geo';

import {
  isVehicleLegType,
  navThresholdsFor,
  resolveActiveLegType,
  resolveCurrentLegType,
  selectNextStepIndex,
  type NavLegType,
} from './legMode';
import type { NavStepMode } from './types';

/** 連續幾個偏離樣本才判定偏航（單一飄移的 GPS 點不算）。 */
export const OFF_ROUTE_HITS = 3;
/** 離路線超過這個距離，GPS 不再驅動進度與鏡頭（投影已無意義）。 */
export const FOLLOW_GPS_MAX_M = 500;

/**
 * 語音後端交接過來的步驟沒有 `polylineIndex`，所有 waypoint 都會落在路線起點。把它們平均分散到
 * 各自的 leg 上，讓 instructions 端點沒回應時，選步驟與抵達判斷仍可用（SDD §6.4 不變量：
 * 語音交接步驟必須以 leg-relative 方式推算）。逐行移植自 Web `withSyntheticPolylineIndices`。
 */
export function withSyntheticPolylineIndices(
  instructions: NavInstruction[],
  { path, legRanges }: CumulativePath,
): NavInstruction[] {
  if (instructions.length === 0 || path.length === 0) return instructions;
  if (instructions.some((ins) => ins.polylineIndex != null)) return instructions;

  const positionsByLeg = new Map<number, number[]>();
  instructions.forEach((ins, index) => {
    const legIndex = ins.legIndex ?? -1;
    const positions = positionsByLeg.get(legIndex);
    if (positions) positions.push(index);
    else positionsByLeg.set(legIndex, [index]);
  });

  const resolved = new Array<number>(instructions.length).fill(0);
  for (const [legIndex, positions] of positionsByLeg) {
    const range = legIndex >= 0 ? legRanges[legIndex] : undefined;
    // leg 區間可解析時 polylineIndex 是 leg-relative；否則是整條串接路徑的索引。
    const count = range && range.count > 0 ? range.count : path.length;
    positions.forEach((instructionIndex, position) => {
      const fraction = positions.length === 1 ? 1 : position / (positions.length - 1);
      resolved[instructionIndex] = Math.round(fraction * (count - 1));
    });
  }

  return instructions.map((ins, index) => ({ ...ins, polylineIndex: resolved[index] }));
}

/** GPS 只有在離路線夠近時才能錨定鏡頭（Web `gpsNearRoute`）。 */
export function gpsNearRoute(loc: LatLng | null, cp: CumulativePath | null): boolean {
  if (!loc || !cp || cp.path.length === 0) return false;
  return projectToPath(loc, cp.path, cp.cumM).perpDistM <= FOLLOW_GPS_MAX_M;
}

/**
 * 自動判斷導航情境（`NavStepMode`）：定位在路線附近＝實際導航；沒有定位或離路線太遠＝預覽。
 * `live` 是單向的：實際導航中走遠了是偏航（交給重算），不會變回可手動切換的預覽；
 * 預覽中定位來到路線附近（例：冷啟動 GPS 晚到、或人真的走到起點）才升級成 `live`。
 */
export function resolveStepMode(current: NavStepMode, loc: LatLng | null, cp: CumulativePath | null): NavStepMode {
  if (current === 'live') return 'live';
  return gpsNearRoute(loc, cp) ? 'live' : 'preview';
}

export interface EngineState {
  currentStepIndex: number;
  isOffRoute: boolean;
  arrived: boolean;
  /** 連續偏離樣本數（Web `offHitsRef`）。 */
  offRouteHits: number;
  /** 上一個樣本的 leg 類型（Web `lastLegTypeRef`），用來偵測開車↔步行交接。 */
  lastLegType: NavLegType | null;
}

export interface ProgressInput {
  position: LatLng;
  geometry: { path: CumulativePath; waypoints: Waypoint[] };
  instructions: readonly NavInstruction[];
  state: EngineState;
  now: number;
  /** 路線總分鐘數，用來按比例估剩餘時間；沒有就不估。 */
  routeTotalMinutes: number | null;
}

export interface ProgressUpdate {
  distanceToNextM: number | null;
  remainingM: number;
  remainingDurationSec: number | null;
  estimatedArrivalAt: number | null;
  etaSource: 'local';
}

export type OffRouteSignal =
  /** 已連續偏離：通知重算協調器（它自己處理冷卻與去重）。 */
  | 'confirm'
  /** 回到路線上：結束這一輪偏航 episode。 */
  | 'clear'
  /** 偏離但還沒達到連續門檻：不通知、也不結束 episode（Web 在這個分支什麼都不呼叫）。 */
  | 'none';

export interface ProgressResult {
  /** 下一次呼叫要帶入的狀態。 */
  state: EngineState;
  offRoute: OffRouteSignal;
  /** 從偏航回到路線：呼叫端要把重算狀態設回 idle（Web `setRerouteIdle`）。 */
  backOnRoute: boolean;
  /** 這個樣本跨越了開車／步行邊界：呼叫端要重置 heading 平滑並重新取景（Web `applyLegHandoff`）。 */
  legHandoff: boolean;
  activeLegType: NavLegType | null;
  progress: ProgressUpdate;
  /** 第一次抵達（`arrived` 只會從 false 變 true 一次）。 */
  arrivedNow: boolean;
}

/**
 * 一個定位樣本對導航的影響。回傳 null 代表這個樣本不能驅動進度（離路線太遠、幾何還沒就緒），
 * 呼叫端什麼都不改（步驟停在原處，等偏航重算或定位回到路線附近）。
 */
export function advanceNavigation(input: ProgressInput): ProgressResult | null {
  const { position, geometry, instructions, now } = input;
  const cp = geometry.path;
  const wps = geometry.waypoints;
  if (cp.path.length === 0 || wps.length === 0) return null;

  const proj = projectToPath(position, cp.path, cp.cumM);
  // 離路線很遠的定位投影沒有意義（會自動前進到「最近」的那一段）。
  if (proj.perpDistM > FOLLOW_GPS_MAX_M) return null;

  const state: EngineState = { ...input.state };
  const activeLegType = resolveCurrentLegType(instructions, wps, proj.alongM);
  const thresholds = navThresholdsFor(activeLegType);

  let offRoute: OffRouteSignal;
  let backOnRoute = false;
  if (proj.perpDistM > thresholds.offRouteM) {
    state.offRouteHits += 1;
    offRoute = state.offRouteHits >= OFF_ROUTE_HITS ? 'confirm' : 'none';
    if (offRoute === 'confirm') state.isOffRoute = true;
  } else {
    state.offRouteHits = 0;
    if (state.isOffRoute) {
      state.isOffRoute = false;
      backOnRoute = true;
    }
    offRoute = 'clear';
  }

  // 下一個轉向點＝沿路線第一個仍在前方的 waypoint，各自以所屬 leg 的抵達半徑判斷。
  const nextIdx = selectNextStepIndex(instructions, wps, proj.alongM);
  // 步驟只由定位驅動、且只往前（對齊 Google／Apple Maps、Mapbox RouteProgress）：往回走不會倒退步驟，
  // 真的離開路線交給偏航→重算處理。實際導航刻意不接受手動切換，避免 HUD 與使用者實際位置脫節；
  // 只有預覽（`resolveStepMode` 判定人不在路線附近）才開放手動切換，且那時定位不會進到這裡。
  if (nextIdx > state.currentStepIndex) state.currentStepIndex = nextIdx;

  let legHandoff = false;
  if (
    state.lastLegType !== null &&
    activeLegType !== null &&
    isVehicleLegType(state.lastLegType) !== isVehicleLegType(activeLegType)
  ) {
    legHandoff = true;
    // 交接時丟掉以開車容忍度累積的偏航計數，並解除偏航（Web `applyLegHandoff`）。
    state.offRouteHits = 0;
    if (state.isOffRoute) {
      state.isOffRoute = false;
      backOnRoute = true;
    }
  }
  state.lastLegType = activeLegType;

  const totalM = cp.cumM[cp.cumM.length - 1] ?? 0;
  const remainingM = Math.max(0, totalM - proj.alongM);
  const totalSec = input.routeTotalMinutes != null ? input.routeTotalMinutes * 60 : null;
  const remainingDurationSec = totalSec != null && totalM > 0 ? Math.round(totalSec * (remainingM / totalM)) : null;
  const target = wps[Math.min(state.currentStepIndex, wps.length - 1)];

  // 抵達：靠近最後一個轉向點，以最後一段 leg 的半徑判斷（純開車路線終點是停車格，不是門口）。
  // 不得以放寬門檻處理「一按導航就抵達」——根因是 per-leg 索引錯配（SDD §6.4）。
  const finalWp = wps[wps.length - 1];
  const finalThresholds = navThresholdsFor(resolveActiveLegType(instructions, instructions.length - 1));
  const arrivedNow =
    !state.arrived && !!finalWp?.coord && haversineMeters(position, finalWp.coord) < finalThresholds.finalArriveM;
  if (arrivedNow) state.arrived = true;

  return {
    state,
    offRoute,
    backOnRoute,
    legHandoff,
    activeLegType,
    progress: {
      distanceToNextM: target ? Math.max(0, target.alongM - proj.alongM) : null,
      remainingM,
      remainingDurationSec,
      estimatedArrivalAt: remainingDurationSec != null ? now + remainingDurationSec * 1000 : null,
      etaSource: 'local',
    },
    arrivedNow,
  };
}

// ---- 方位平滑（Web 相機迴圈用的 helper；原生鏡頭跟隨在 Mac 上接 UI 時決定是否沿用） ----

/** 指數平滑係數：`dtMs` 經過後向目標靠近的比例。 */
export function smoothingFactor(dtMs: number, tauMs: number): number {
  return 1 - Math.exp(-dtMs / tauMs);
}

/** 兩個角度之間的最短角距（0–180）。 */
export function angularDistanceDeg(a: number, b: number): number {
  return Math.abs(((b - a + 540) % 360) - 180);
}
