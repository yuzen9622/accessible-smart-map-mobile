import { useBusStore } from '@/features/bus';
import { projectToPath, type AccessibleRoute, type NavInstruction } from '@/features/route/domain';
import type { LatLng } from '@/shared/geo';

import {
  alongSpeedMps,
  AT_STOP_RADIUS_M,
  BOARD_CONFIRM_SAMPLES,
  BOARD_FAR_PAST_M,
  buildTransitGuide,
  findActiveBusRun,
  findBusRuns,
  hasBoarded,
  legAlongRange,
  rideStops,
  transitAnnouncement,
  type BusRun,
  type RideStop,
  type TransitGuide,
  type TransitSpeech,
} from '../domain/transitRide';
import { useNavStore } from '../store/navStore';
import type { NavigationGeometryRuntime } from './navigationGeometryRuntime';

/**
 * 公車段的等車／搭乘狀態（`domain/transitRide.ts` 的副作用面）：
 * - 還沒上車時把引擎的步驟上限卡在上車指令（`maxStepIndex`），人到站牌不會直接跳到「到站後請下車」；
 * - 每個定位樣本判斷是否已上車（離開站牌、沿公車路線前進），上車後通知公車 feature 改查那台車到下車站；
 * - 依步驟、定位與公車 feature 的即時分鐘數組 `transitGuide` 寫進 navStore，情境改變時播報。
 * 狀態跟著一組 instructions：換路線（重算、語音交接）就重置。
 */
export interface TransitRideRuntime {
  /** 引擎從 `fromStepIndex` 推進時的步驟上限：還沒上車就停在那段公車的上車指令。 */
  maxStepIndex(fromStepIndex: number): number | null;
  observe(position: LatLng): void;
  sync(): void;
  /** 這一步由本模組播報（公車段的上車／下車指令），一般的步驟播報要跳過。 */
  ownsStepSpeech(stepIndex: number): boolean;
  /** 剛離開公車段（越過下車指令）時，下一步播報前要先說的話。 */
  alightPrefix(previousStepIndex: number, stepIndex: number): string | null;
  start(): () => void;
}

export interface TransitRideDeps {
  geometry: NavigationGeometryRuntime;
  route: () => AccessibleRoute | null;
  speak: (text: string) => void;
  /** 播報文字（i18n）；沒有時不播報公車段情境（測試、語音接手前）。 */
  speechText?: (speech: TransitSpeech | { kind: 'alight'; alightStop: string }) => string;
  now: () => number;
}

export function createTransitRideRuntime(deps: TransitRideDeps): TransitRideRuntime {
  let instructions: readonly NavInstruction[] | null = null;
  const boarded = new Set<number>();
  let lastSample: { alongM: number; at: number } | null = null;
  let lastAlongM: number | null = null;
  let lastTargetPlate: { key: string; plate: string } | null = null;
  /** 使用者已離開還沒上車那段的站牌（沿線超過站牌半徑）：之後不再更新車牌——開走的那台才是使用者搭的。 */
  let leftStop = false;
  /** 連續符合上車條件的樣本數（`boardHitsRun` 那段公車）。 */
  let boardHits = 0;
  let boardHitsRun: number | null = null;
  let spoken = new Set<string>();
  let spokenRun: number | null = null;
  let prevGuide: TransitGuide | null = null;
  let stopsCache: { run: number; stops: RideStop[] | null } | null = null;

  /** 換了一組指令：前一組的上車判斷、播報記錄與站點都作廢。 */
  function current(): readonly NavInstruction[] {
    const next = useNavStore.getState().instructions;
    if (next !== instructions) {
      instructions = next;
      boarded.clear();
      lastSample = null;
      lastAlongM = null;
      spoken = new Set();
      spokenRun = null;
      prevGuide = null;
      stopsCache = null;
      lastTargetPlate = null;
      leftStop = false;
      boardHits = 0;
      boardHitsRun = null;
    }
    return next;
  }

  /** 從 `fromStepIndex` 起第一段還沒上車的公車：下車指令還沒過、也還沒判定上車。 */
  function pendingRun(fromStepIndex: number): BusRun | null {
    return findBusRuns(current()).find((r) => r.alightIndex >= fromStepIndex && !boarded.has(r.boardIndex)) ?? null;
  }

  /** 只有在本機實際導航（不是預覽、不是語音接手）時才有等車／搭乘狀態。 */
  function liveLocal(): boolean {
    const nav = useNavStore.getState();
    return nav.stepMode === 'live' && nav.navigationSource === 'local';
  }

  function activeRun(): BusRun | null {
    return findActiveBusRun(current(), useNavStore.getState().currentStepIndex);
  }

  /** 公車 feature 目前追的是不是這段公車（導航用的 key 以 `nav:<ordinal>:` 開頭）。 */
  function trackedKey(run: BusRun): string | null {
    const key = useBusStore.getState().activeBusLeg?.key;
    return key?.startsWith(`nav:${run.ordinal}:`) ? key : null;
  }

  /** 把上車判定交給公車 feature（只標記同一段；公車 feature 還沒追到這段時，下次 sync 再補）。 */
  function syncBoardedToBus(run: BusRun): void {
    const key = trackedKey(run);
    if (!key || useBusStore.getState().activeBusLeg?.boarded) return;
    const plate = lastTargetPlate?.key === key ? lastTargetPlate.plate : null;
    useBusStore.getState().markBoarded(key, plate);
  }

  function markBoarded(run: BusRun): void {
    boarded.add(run.boardIndex);
    boardHits = 0;
    syncBoardedToBus(run);
  }

  function liveMinutes(run: BusRun): number | null {
    if (!trackedKey(run)) return null;
    const arrival = useBusStore.getState().legArrival;
    const want = boarded.has(run.boardIndex) ? 'alight' : 'board';
    return arrival?.stop === want ? arrival.eta : null;
  }

  function stopsFor(run: BusRun, route: AccessibleRoute): RideStop[] | null {
    if (stopsCache?.run === run.boardIndex) return stopsCache.stops;
    const leg = route.legs[run.legIndex];
    const cp = deps.geometry.path;
    const stops = leg?.type === 'BUS' && cp ? rideStops(leg, cp, run.legIndex) : null;
    stopsCache = { run: run.boardIndex, stops };
    return stops;
  }

  function sameGuide(a: TransitGuide | null, b: TransitGuide | null): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  const runtime: TransitRideRuntime = {
    maxStepIndex(fromStepIndex) {
      // 第一段還沒上車的公車（含目前步驟已在它的上車～下車之間，例如一開導航人就在第二段公車上）。
      return pendingRun(fromStepIndex)?.boardIndex ?? null;
    },

    observe(position) {
      const cp = deps.geometry.path;
      const nav = useNavStore.getState();
      const run = pendingRun(nav.currentStepIndex);
      if (!cp) {
        lastSample = null;
        return;
      }
      const at = deps.now();
      const alongM = projectToPath(position, cp.path, cp.cumM).alongM;
      const boardAlongM = run ? deps.geometry.waypoints[run.boardIndex]?.alongM : undefined;
      if (run && boardAlongM != null && nav.currentStepIndex >= run.boardIndex) {
        const pastStopM = alongM - boardAlongM;
        leftStop = pastStopM > AT_STOP_RADIUS_M;
        if (boardHitsRun !== run.boardIndex) {
          boardHitsRun = run.boardIndex;
          boardHits = 0;
        }
        if (pastStopM >= BOARD_FAR_PAST_M) markBoarded(run);
        else if (hasBoarded(pastStopM, alongSpeedMps(lastSample, alongM, at))) {
          boardHits += 1;
          if (boardHits >= BOARD_CONFIRM_SAMPLES) markBoarded(run);
        } else boardHits = 0;
      } else {
        leftStop = false;
      }
      lastSample = { alongM, at };
      lastAlongM = alongM;
    },

    sync() {
      const nav = useNavStore.getState();
      if (!liveLocal()) {
        // 預覽（手動切步驟）或語音接手：沒有等車／搭乘狀態，不留舊導引、不播報。
        if (nav.transitGuide) nav.setTransitGuide(null);
        prevGuide = null;
        return;
      }
      const run = activeRun();
      if (run && boarded.has(run.boardIndex)) syncBoardedToBus(run);
      const route = deps.route();
      const cp = deps.geometry.path;
      const leg = run && route ? route.legs[run.legIndex] : undefined;
      let guide: TransitGuide | null = null;
      if (run && route && cp && leg?.type === 'BUS') {
        const range = legAlongRange(cp, run.legIndex);
        const boardAlongM = deps.geometry.waypoints[run.boardIndex]?.alongM ?? range?.startM ?? 0;
        guide = buildTransitGuide(
          {
            run,
            leg,
            boarded: boarded.has(run.boardIndex),
            alongM: lastAlongM,
            boardAlongM,
            stops: stopsFor(run, route),
            legEndAlongM: range?.endM ?? boardAlongM,
            liveMinutes: liveMinutes(run),
          },
          nav.currentStepIndex,
        );
      }
      if (!sameGuide(guide, nav.transitGuide)) nav.setTransitGuide(guide);

      const runKey = run?.boardIndex ?? null;
      if (runKey !== spokenRun) {
        spoken = new Set();
        spokenRun = runKey;
      }
      const { speech, remember, reset } = transitAnnouncement(prevGuide, guide, spoken);
      if (reset) spoken = new Set();
      for (const key of remember) spoken.add(key);
      prevGuide = guide;
      if (speech && deps.speechText) deps.speak(deps.speechText(speech));
    },

    ownsStepSpeech(stepIndex) {
      // 預覽（手動切步驟）與語音接手時沒有等車／搭乘狀態，照原本念指令文字。
      if (!liveLocal()) return false;
      const run = findActiveBusRun(current(), stepIndex);
      return run !== null && stepIndex >= run.boardIndex && stepIndex <= run.alightIndex;
    },

    alightPrefix(previousStepIndex, stepIndex) {
      const run = findActiveBusRun(current(), previousStepIndex);
      if (!run || previousStepIndex < run.boardIndex || stepIndex <= run.alightIndex || !deps.speechText) return null;
      const leg = deps.route()?.legs[run.legIndex];
      return leg?.type === 'BUS' ? deps.speechText({ kind: 'alight', alightStop: leg.arrivalStop }) : null;
    },

    start() {
      const unsubscribeBus = useBusStore.subscribe((state, previous) => {
        const target = state.liveBusPositions.find((b) => b.isTarget);
        const key = state.activeBusLeg?.key;
        // 上車那一刻那台車可能已被判定「過了上車站」而不再回報，接著下一班變成新的目標：
        // 記住人還在站牌時最後鎖定的車牌，離開站牌後就不再換。
        if (target && key && !leftStop) lastTargetPlate = { key, plate: target.plateNumb };
        if (state.legArrival !== previous.legArrival || state.activeBusLeg !== previous.activeBusLeg) runtime.sync();
      });
      // 換步驟、進出預覽、語音接手：導引要跟著更新或清掉（不必等下一個定位或公車資料）。
      const unsubscribeNav = useNavStore.subscribe((state, previous) => {
        if (
          state.currentStepIndex !== previous.currentStepIndex ||
          state.stepMode !== previous.stepMode ||
          state.navigationSource !== previous.navigationSource
        ) {
          runtime.sync();
        }
      });
      return () => {
        unsubscribeBus();
        unsubscribeNav();
      };
    },
  };
  return runtime;
}
