import { useUserLocationStore } from '@/features/map';
import { getRouteInstructions, getRouteSessionSnapshot, subscribeRouteSession } from '@/features/route';
import {
  buildCumulativePath,
  projectToPath,
  shortestAngleLerp,
  type AccessibleRoute,
  type NavInstructionsData,
  type NavInstructionsRequest,
} from '@/features/route/domain';
import { ApiError, type ApiResponse } from '@/shared/api';
import type { LatLng } from '@/shared/geo';
import type { LocationPort } from '@/shared/location';
import type { VisibilitySource } from '@/shared/polling';

import { selectAdvisoryAnnouncement } from '../domain/advisorySpeech';
import { requestForegroundLocationFix } from '../domain/foregroundLocation';
import { isVehicleLegType, resolveActiveLegType, resolveCurrentLegType, resolveNavHeading } from '../domain/legMode';
import { shouldSpeakLocally } from '../domain/navigationAudio';
import {
  advanceNavigation,
  angularDistanceDeg,
  smoothingFactor,
  withSyntheticPolylineIndices,
  type EngineState,
} from '../domain/navigationEngine';
import { useNavStore } from '../store/navStore';
import type { LocalRerouteCoordinator } from './localRerouteCoordinator';
import {
  createNavigationGeometryRuntime,
  observeLocalNavigationGeometry,
  replaceNavigationGeometryRuntime,
} from './navigationGeometryRuntime';

/**
 * NavigationController（SDD §6.4）：Web `src/hook/useNavigation.ts`（commit 5eadc71）裡**非鏡頭**的部分，
 * 從 React effect 改成可啟停、依賴注入的物件：
 *
 * - **定位單一來源**：只訂閱 map 的 `useUserLocationStore`（Web 同樣只對 store 的 `userLocation` 反應）。
 *   導航期間請 map 把定位監看升到 best-for-navigation；回前景的單次定位、之後的背景定位任務都寫進
 *   同一個 store，自然會驅動導航。同一個 fix 的位置與航向分兩次寫入 store，以 microtask 合併成一次處理。
 * - 取導航指令（含語音交接：先用合成的 polylineIndex 跑，精確指令回來再換上）。路線被換掉、
 *   或改由語音接手時，進行中的請求作廢，晚到的回應不得覆蓋新狀態。
 * - 每個定位樣本交給 `advanceNavigation`，套用步驟前進、偏航→重算協調器、進度、抵達（只一次）。
 * - 方位：步行時新鮮的羅盤優先、開車時 GPS 航向優先（`resolveNavHeading`），指數平滑後節流寫入 store
 *   （Web 在 rAF 每幀平滑；這裡事件驅動，並補一次 trailing write，事件停了 store 也會收斂到最新值）。
 * - 播報：Web 寫在 HUD 元件裡；原生要在鎖屏／背景也能播，所以移到這裡，經 `SpeechPort` 發聲；
 *   語音助理接手播報時立刻停掉本機 TTS（兩個喇叭不得同時發聲）。
 *
 * 鏡頭跟隨、開場飛行、步驟預覽鏡頭屬於地圖 UI，在 Mac 上接 HUD 時實作，經 `onLegHandoff`／`onStepChange` 取景。
 */

export interface SpeechPort {
  speak(text: string, language: 'zh-TW' | 'en'): void;
  stop(): void;
}

export const silentSpeech: SpeechPort = { speak: () => {}, stop: () => {} };

export interface NavigationControllerDeps {
  location: Pick<LocationPort, 'getCurrent'>;
  visibility: VisibilitySource;
  reroute: Pick<LocalRerouteCoordinator, 'triggerAutoReroute' | 'clearOffRoute'>;
  speech: SpeechPort;
  language: () => 'zh-TW' | 'en';
  /** 「已抵達」的播報文字（i18n `arrivedDesc`），由呼叫端提供以免 controller 依賴 i18n 實例。 */
  arrivedText: () => string;
  /** 語音助理是否擁有導航播報（Phase 4 前沒有語音 feature，預設 false）。 */
  geminiOwnsSpeech?: () => boolean;
  /** 播報擁有者改變時通知（Phase 4 由語音 feature 提供）；變成語音助理時立刻停掉本機 TTS。 */
  subscribeSpeechOwner?: (onChange: (geminiOwns: boolean) => void) => () => void;
  fetchInstructions?: (
    request: NavInstructionsRequest,
    signal?: AbortSignal,
  ) => Promise<ApiResponse<NavInstructionsData>>;
  now?: () => number;
  onLegHandoff?: (stepIndex: number, target: LatLng | null) => void;
  onStepChange?: (stepIndex: number) => void;
}

export interface NavigationController {
  start(): void;
  stop(): void;
}

const HEADING_WRITE_MS = 80;
const HEADING_TAU_MS = 320;
const COMPASS_FRESH_MS = 1500;
const COMPASS_MIN_DELTA_DEG = 1;

export function createNavigationController(deps: NavigationControllerDeps): NavigationController {
  const now = deps.now ?? Date.now;
  const fetchInstructions = deps.fetchInstructions ?? getRouteInstructions;
  const geminiOwnsSpeech = deps.geminiOwnsSpeech ?? (() => false);

  const geometry = createNavigationGeometryRuntime();
  let engine: Pick<EngineState, 'offRouteHits' | 'lastLegType'> = { offRouteHits: 0, lastLegType: null };
  let cleanups: (() => void)[] = [];
  let running = false;
  let instructionsAbort: AbortController | null = null;
  let positionQueued = false;

  // 方位工作狀態（Web 的 compassRef／smoothRef／lastHeadingTs）。
  let compass: number | null = null;
  let compassTs = 0;
  let smoothed: number | null = null;
  let lastSmoothTs: number | null = null;
  let lastHeadingWrite = 0;
  let trailingHeading: ReturnType<typeof setTimeout> | null = null;

  const spokenAdvisoryKeys = new Set<string>();

  function speak(text: string): void {
    // 每次都重新讀開關：播報可能在使用者剛切換之後觸發。
    const maySpeak = shouldSpeakLocally({
      geminiOwnsSpeech: geminiOwnsSpeech(),
      localVoiceEnabled: useNavStore.getState().voiceEnabled,
    });
    if (!maySpeak) return;
    deps.speech.stop();
    deps.speech.speak(text, deps.language());
  }

  function currentRoute(): AccessibleRoute | null {
    return getRouteSessionSnapshot().selectRoute?.route ?? null;
  }

  function resetHeading(): void {
    smoothed = null;
    lastSmoothTs = null;
    compass = null;
    compassTs = 0;
  }

  function flushHeading(source: 'compass' | 'gps' | null): void {
    if (trailingHeading) clearTimeout(trailingHeading);
    trailingHeading = null;
    if (smoothed == null || !running) return;
    lastHeadingWrite = now();
    useNavStore.getState().setUserHeading(Math.round(smoothed * 10) / 10, source);
  }

  function writeHeading(isVehicle: boolean): void {
    const nav = useNavStore.getState();
    const t = now();
    const resolved = resolveNavHeading({
      isVehicle,
      compassHeading: compass,
      compassAgeMs: t - compassTs,
      compassFreshMs: COMPASS_FRESH_MS,
      gpsHeading: nav.gpsHeading,
      userHeading: nav.userHeading,
      headingSource: nav.headingSource,
    });
    if (!resolved) return;
    const dt = lastSmoothTs == null ? 0 : Math.min(Math.max(t - lastSmoothTs, 0), 1000);
    lastSmoothTs = t;
    smoothed =
      smoothed == null
        ? resolved.heading
        : shortestAngleLerp(smoothed, resolved.heading, smoothingFactor(dt, HEADING_TAU_MS));
    if (t - lastHeadingWrite > HEADING_WRITE_MS) {
      flushHeading(resolved.source);
      return;
    }
    // 節流期間內的最後一個值也要寫出去，否則事件停了 store 會停在舊值。
    if (trailingHeading) clearTimeout(trailingHeading);
    const source = resolved.source;
    trailingHeading = setTimeout(() => flushHeading(source), HEADING_WRITE_MS);
  }

  function activeIsVehicle(position: LatLng | null): boolean {
    const nav = useNavStore.getState();
    if (position && geometry.path && geometry.waypoints.length) {
      const along = projectToPath(position, geometry.path.path, geometry.path.cumM).alongM;
      return isVehicleLegType(resolveCurrentLegType(nav.instructions, geometry.waypoints, along));
    }
    return isVehicleLegType(resolveActiveLegType(nav.instructions, nav.currentStepIndex));
  }

  function processPosition(): void {
    positionQueued = false;
    if (!running) return;
    const { position, course } = useUserLocationStore.getState();
    if (!position) return;
    const nav = useNavStore.getState();
    if (course != null) nav.setGpsHeading(course);
    writeHeading(activeIsVehicle(position));

    if (nav.navigationSource === 'voice' || !geometry.path) return;
    const result = advanceNavigation({
      position,
      geometry: { path: geometry.path, waypoints: geometry.waypoints },
      instructions: nav.instructions,
      state: {
        currentStepIndex: nav.currentStepIndex,
        isOffRoute: nav.isOffRoute,
        arrived: nav.arrived,
        ...engine,
      },
      now: now(),
      routeTotalMinutes: currentRoute()?.totalMinutes ?? null,
    });
    if (!result) return;

    engine = { offRouteHits: result.state.offRouteHits, lastLegType: result.state.lastLegType };
    // 順序對齊 Web：先處理偏航（confirm 會同步 setPending），再處理交接／回到路線（setRerouteIdle），
    // 同一樣本兩者都發生時最後是 idle，重算遮罩不會卡住。
    if (result.offRoute === 'confirm') {
      if (!nav.isOffRoute) nav.setIsOffRoute(true);
      void deps.reroute.triggerAutoReroute(position);
    } else if (result.offRoute === 'clear') {
      deps.reroute.clearOffRoute();
    }
    if (result.backOnRoute) {
      nav.setIsOffRoute(false);
      nav.setRerouteIdle();
    }

    if (result.state.currentStepIndex !== nav.currentStepIndex) {
      nav.setCurrentStepIndex(result.state.currentStepIndex);
    }
    if (result.legHandoff) {
      resetHeading();
      const target = geometry.waypoints[result.state.currentStepIndex]?.coord ?? position;
      deps.onLegHandoff?.(result.state.currentStepIndex, target);
    }
    nav.setProgress(result.progress);
    if (result.arrivedNow) nav.setArrived(true);
  }

  /** 同一個 fix 的位置與航向分兩次寫入 store：合併成一次處理。 */
  function queuePosition(): void {
    if (positionQueued) return;
    positionQueued = true;
    void (async () => {
      await Promise.resolve();
      processPosition();
    })();
  }

  function handleCompass(heading: number): void {
    if (!running) return;
    if (compass == null || angularDistanceDeg(compass, heading) >= COMPASS_MIN_DELTA_DEG) compass = heading;
    compassTs = now();
    writeHeading(activeIsVehicle(useUserLocationStore.getState().position));
  }

  /** 語音交接帶過來的步驟先用合成索引跑，不必等 instructions 請求（Web `applyCarriedInstructions`）。 */
  function applyCarriedInstructions(route: AccessibleRoute): void {
    const nav = useNavStore.getState();
    const cp = buildCumulativePath(route.legs);
    const patched = withSyntheticPolylineIndices(nav.instructions, cp);
    if (patched !== nav.instructions) {
      const carriedAdvisories = nav.advisories;
      const carriedStepIndex = Math.max(0, Math.min(nav.currentStepIndex, patched.length - 1));
      // 一次寫入：Web 的 effect 會合批；這裡若分成 setInstructions＋setCurrentStepIndex，
      // 播報會先念第 0 步再念接手的那一步。
      nav.setNavigationIdentity(route.navigationId ?? null, route.routeVersion ?? 0);
      nav.setInstructions(patched, nav.warnings, carriedStepIndex);
      if (carriedAdvisories.length > 0) useNavStore.getState().pushAdvisories(carriedAdvisories);
    }
    replaceNavigationGeometryRuntime(geometry, route, useNavStore.getState().instructions);
    useNavStore.getState().setRouteTotalM(cp.cumM.at(-1) ?? null);
    // 幾何在 store 之外換掉：不等下一個定位就立刻重新投影。
    queuePosition();
  }

  function abortInstructions(): void {
    instructionsAbort?.abort();
    instructionsAbort = null;
  }

  /**
   * @param afterReroute 重算套用後的重取：重算請求沒有 `language` 欄位，回應的指令語言由後端決定，
   *   所以用使用者語系再取一次（Web 在路線換掉時也會重取）。保留重算原因與警報，不像 Web 那樣清掉。
   */
  async function loadInstructions(tookOverFromVoice: boolean, afterReroute = false): Promise<void> {
    const route = currentRoute();
    if (!route || useNavStore.getState().navigationSource === 'voice') return;
    // 開場先裝好路徑，instructions 回來前進度也能以幾何估（Web intro effect 做同一件事）。
    if (!geometry.path) geometry.path = buildCumulativePath(route.legs);
    if (tookOverFromVoice) applyCarriedInstructions(route);

    const routeToken = route.routeToken;
    if (!routeToken) return;
    abortInstructions();
    const controller = new AbortController();
    instructionsAbort = controller;
    try {
      const res = await fetchInstructions(
        { routeToken, userHeading: useNavStore.getState().userHeading ?? undefined, language: deps.language() },
        controller.signal,
      );
      // 等待期間路線被換掉（重算）或改由語音接手：這份回應描述的已不是目前的導航（Web 以 cancelled 旗標丟掉）。
      if (
        controller.signal.aborted ||
        !running ||
        currentRoute() !== route ||
        useNavStore.getState().navigationSource !== 'local'
      ) {
        return;
      }
      if (!res.ok || !res.data?.instructions) return;
      replaceNavigationGeometryRuntime(geometry, route, res.data.instructions);
      const cp = geometry.path;
      if (!cp) return;
      const nav = useNavStore.getState();
      nav.setNavigationIdentity(route.navigationId ?? null, route.routeVersion ?? 0);
      // setInstructions 會清掉警報（換路線就失效），但從語音接手不是換路線，警報要保留。
      const carriedAdvisories = tookOverFromVoice || afterReroute ? nav.advisories : [];
      const carriedReason = afterReroute ? nav.lastRerouteReason : null;
      nav.setInstructions(res.data.instructions, res.data.warnings ?? []);
      if (carriedAdvisories.length > 0) useNavStore.getState().pushAdvisories(carriedAdvisories);
      if (carriedReason) useNavStore.getState().setLastRerouteReason(carriedReason);
      useNavStore.getState().setRouteTotalM(cp.cumM[cp.cumM.length - 1] ?? null);
      if (tookOverFromVoice) queuePosition();
    } catch (error) {
      // Web 同樣吞掉：沒有指令時 HUD 以路線幾何顯示，使用者仍可手動切步驟。
      // `INVALID_ROUTE_TOKEN`＝routeToken 過期（30 分鐘）或無效，重試同一個 token 不會成功，維持幾何導引。
      if (error instanceof ApiError && error.reason === 'INVALID_ROUTE_TOKEN') {
        console.warn('[navigation] routeToken expired; falling back to geometry-based guidance');
      }
    } finally {
      if (instructionsAbort === controller) instructionsAbort = null;
    }
  }

  function subscribeAnnouncements(): () => void {
    return useNavStore.subscribe((state, previous) => {
      if (state.instructions !== previous.instructions || state.currentStepIndex !== previous.currentStepIndex) {
        const step = state.instructions[state.currentStepIndex];
        if (step) speak(step.text);
        if (state.currentStepIndex !== previous.currentStepIndex) deps.onStepChange?.(state.currentStepIndex);
      }
      if (state.arrived && !previous.arrived) speak(deps.arrivedText());
      if (state.advisories !== previous.advisories || state.arrived !== previous.arrived) {
        const { keysToRemember, speech } = selectAdvisoryAnnouncement(state.advisories, spokenAdvisoryKeys, {
          arrived: state.arrived,
        });
        for (const key of keysToRemember) spokenAdvisoryKeys.add(key);
        if (speech) speak(speech);
      }
      if (state.voiceEnabled !== previous.voiceEnabled && !state.voiceEnabled) deps.speech.stop();
    });
  }

  function subscribeSourceChanges(): () => void {
    return useNavStore.subscribe((state, previous) => {
      if (state.navigationSource === previous.navigationSource) return;
      if (state.navigationSource === 'voice') {
        // 語音後端接手：本機進行中的 instructions 請求不得晚到覆蓋語音的狀態。
        abortInstructions();
        return;
      }
      // 從語音接手本機導航（Web：navigationSource 由 voice 變 local 時重跑 instructions effect）。
      if (previous.navigationSource === 'voice') void loadInstructions(true);
    });
  }

  function subscribeLocation(): () => void {
    return useUserLocationStore.subscribe((state, previous) => {
      if (state.position !== previous.position || state.course !== previous.course) queuePosition();
      if (state.heading !== previous.heading && state.heading != null) handleCompass(state.heading);
    });
  }

  return {
    start() {
      if (running) return;
      running = true;
      engine = { offRouteHits: 0, lastLegType: null };
      resetHeading();
      spokenAdvisoryKeys.clear();
      const location = useUserLocationStore.getState();
      location.setNavigationAccuracy(true);
      cleanups.push(() => useUserLocationStore.getState().setNavigationAccuracy(false));
      cleanups.push(observeLocalNavigationGeometry(geometry));
      cleanups.push(subscribeAnnouncements());
      cleanups.push(subscribeSourceChanges());
      cleanups.push(subscribeLocation());
      cleanups.push(
        subscribeRouteSession((state, previous) => {
          // 路線被換掉（重算）：舊路線的 instructions 請求作廢。
          if (state.selectRoute?.route === previous.selectRoute?.route) return;
          abortInstructions();
          const next = state.selectRoute?.route;
          if (!next) return;
          // applyRouteReplacement 先換路線、再更新 navStore 身分：等這一輪同步寫入結束再判斷。
          void (async () => {
            await Promise.resolve();
            const nav = useNavStore.getState();
            if (!running || currentRoute() !== next || nav.navigationSource !== 'local' || nav.arrived) return;
            if (nav.navigationId !== (next.navigationId ?? null) || nav.routeVersion !== (next.routeVersion ?? 0)) return;
            void loadInstructions(false, true);
          })();
        }),
      );
      if (deps.subscribeSpeechOwner) {
        cleanups.push(
          deps.subscribeSpeechOwner((geminiOwns) => {
            if (geminiOwns) deps.speech.stop();
          }),
        );
      }
      cleanups.push(
        deps.visibility.subscribe((active) => {
          if (!active) return;
          requestForegroundLocationFix({
            isVisible: deps.visibility.isActive,
            getCurrent: async () => {
              const fix = await deps.location.getCurrent({ accuracy: 'best-for-navigation' });
              return { lat: fix.lat, lng: fix.lng, heading: fix.heading };
            },
            onPosition: (position, heading) => {
              const store = useUserLocationStore.getState();
              store.setCourse(heading);
              store.setPosition(position);
            },
          });
        }),
      );
      void loadInstructions(false);
      const nav = useNavStore.getState();
      const step = nav.instructions[nav.currentStepIndex];
      if (step) speak(step.text);
      queuePosition();
    },
    stop() {
      running = false;
      abortInstructions();
      if (trailingHeading) clearTimeout(trailingHeading);
      trailingHeading = null;
      for (const cleanup of cleanups) cleanup();
      cleanups = [];
      deps.speech.stop();
      geometry.path = null;
      geometry.waypoints = [];
    },
  };
}
