import { AccessibilityInfo } from 'react-native';

import { closeChat, type Translate } from '@/features/ai';
import { useUserLocationStore } from '@/features/map';
import { useIndoorStore } from '@/features/indoor';
import type { BackgroundLocationTexts } from '@/shared/location';
import {
  beginNavigation,
  configureNavigationSpeechOwner,
  endNavigation,
  handleVoiceRerouteEvent,
  resolveStepMode,
  useNavStore,
} from '@/features/navigation';
import { selectRouteAt } from '@/features/route/controller/routeSessionPort';
import { buildCumulativePath } from '@/features/route/domain/geo';
import { getRouteSessionSnapshot, subscribeRouteSession } from '@/features/route/hooks/useRouteSession';
import { haversineMeters, type LatLng } from '@/shared/geo';
import { appStateVisibility } from '@/shared/polling';

import {
  isVoiceSpeechChannelLive,
  shouldAcceptAdvisoryEvent,
  type VoiceNavigationEvent,
  type VoiceNavigationPosition,
  type VoiceNavigationState,
  type VoiceStatusName,
  type VoiceUiCommand,
  type VoiceUiCommandResult,
} from '../domain/voiceSession';
import { useVoiceStore } from '../store/voiceStore';

/**
 * 語音助理與 App 導航的接點。導航只有一套：App 自己的引擎（預覽／即時、分段播報、偏航重算）。
 * - 助理要開始／結束／確認室內一步時，後端送 `ui.command`，這裡呼叫和按鈕相同的函式，再回報實際結果。
 * - 引擎狀態以 `nav.state` 回報，助理回答「何時轉彎」時讀它。
 * - 引擎該播報時，語音通道活著就改送 `nav.cue` 讓助理以自然口語說，不另外開本機 TTS。
 * - 後端只用路線與位置偵測危險、設施中斷與交通警報，回來的 advisory／改道套用到同一個引擎。
 */

export interface VoiceNavigationUplink {
  setNavigationRoute(routeToken: string | null): void;
  startNavigation(routeToken: string, position?: VoiceNavigationPosition): void;
  sendNavigationPosition(position: VoiceNavigationPosition): void;
  sendNavigationState(state: VoiceNavigationState): void;
  sendNavigationCue(text: string): void;
  cancelNavigation(): void;
  getStatus(): VoiceStatusName;
}

/** 位置上行的距離節流（與上次送出的點相距 < 10 m 不送）。 */
const POSITION_MIN_DISTANCE_M = 10;
/** 只有距離在變的 `nav.state` 最多每 5 秒送一次；換步、開始、結束立即送。 */
const STATE_MIN_INTERVAL_MS = 5_000;

let uplink: VoiceNavigationUplink | null = null;
let translate: Translate = (key) => key;
let lastSent: LatLng | null = null;
let lastStateSentAt = 0;
let installed = false;
let beginJourney: (texts: BackgroundLocationTexts, kind?: 'handoff') => void = beginNavigation;

export function configureVoiceJourneyNavigation(start: typeof beginJourney): void {
  beginJourney = start;
}

function voiceLive(): boolean {
  return Boolean(uplink && isVoiceSpeechChannelLive(uplink.getStatus()));
}

function notice(message: string): void {
  if (message) AccessibilityInfo.announceForAccessibility(message);
}

function positionPayload(position: LatLng): VoiceNavigationPosition {
  const nav = useNavStore.getState();
  const heading = nav.userHeading ?? nav.gpsHeading;
  return { latitude: position.lat, longitude: position.lng, ...(heading == null ? {} : { heading }) };
}

function routeToken(): string | null {
  const session = getRouteSessionSnapshot();
  const token = (session.navigationRoute ?? session.selectRoute)?.route.routeToken;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

function routeIdentity(): { navigationId: string | null; routeVersion: number } {
  const session = getRouteSessionSnapshot();
  const route = (session.navigationRoute ?? session.selectRoute)?.route;
  const nav = useNavStore.getState();
  return { navigationId: route?.navigationId ?? nav.navigationId, routeVersion: route?.routeVersion ?? nav.routeVersion };
}

function indoorGuiding(): boolean {
  return useIndoorStore.getState().guidance.status === 'guiding';
}

/** 與導航控制器開場相同的判斷：定位在路線附近＝即時，否則＝預覽。 */
function startedGuidance(): 'preview' | 'live' {
  const route = getRouteSessionSnapshot().navigationRoute?.route;
  return resolveStepMode('preview', useUserLocationStore.getState().position, route ? buildCumulativePath(route.legs) : null);
}

/** 等車卡片的內容（前往或等候公車時）；搭乘中或不在公車段沒有。 */
function busWaitOf(guide: ReturnType<typeof useNavStore.getState>['transitGuide']): Pick<VoiceNavigationState, 'busWait'> {
  if (!guide || guide.phase === 'riding') return {};
  return {
    busWait: {
      routeName: guide.routeName,
      stop: guide.boardStop,
      waitMinutes: guide.waitMinutes,
      ...(guide.waitMinutes === null && guide.scheduledAt ? { expectedAt: guide.scheduledAt } : {}),
    },
  };
}

/** App 導航引擎目前的狀態，給助理回答路線問題。 */
export function currentNavigationState(): VoiceNavigationState {
  const indoor = useIndoorStore.getState();
  if (indoor.guidance.status === 'guiding' && indoor.plan.status === 'ready') {
    const steps = indoor.plan.data.steps;
    return {
      active: true,
      guidance: 'indoor',
      travelMode: 'walk',
      destination: getRouteSessionSnapshot().destinationName || null,
      currentStepIndex: indoor.guidance.stepIndex,
      distanceToNextM: steps[indoor.guidance.stepIndex]?.distanceM ?? null,
      steps: steps.map((step, index) => ({
        index, instruction: step.instruction, legType: 'VENUE', distanceM: step.distanceM, maneuver: step.maneuver ?? null,
      })),
    };
  }
  const nav = useNavStore.getState();
  if (!nav.isNavigating) return { active: false };
  const session = getRouteSessionSnapshot();
  return {
    active: !nav.arrived,
    arrived: nav.arrived,
    guidance: nav.stepMode,
    travelMode: session.effectivePreferences?.travelMode ?? session.travelMode,
    destination: session.destinationName || null,
    currentStepIndex: nav.currentStepIndex,
    distanceToNextM: nav.distanceToNextM,
    remainingDistanceM: nav.remainingM,
    remainingDurationSec: nav.remainingDurationSec,
    ...busWaitOf(nav.transitGuide),
    steps: nav.instructions.map((step, index) => ({
      index,
      instruction: step.text,
      legType: step.legType,
      distanceM: step.distanceM,
      streetName: step.streetName,
      maneuver: step.maneuver ?? null,
    })),
  };
}

function publishState(force: boolean): void {
  if (!voiceLive()) return;
  const now = Date.now();
  if (!force && now - lastStateSentAt < STATE_MIN_INTERVAL_MS) return;
  lastStateSentAt = now;
  uplink?.sendNavigationState(currentNavigationState());
}

/** 把畫面切到要導航的那條；畫面上沒有這條就回 false。 */
function selectRouteByToken(token: string): boolean {
  const session = getRouteSessionSnapshot();
  if (session.selectRoute?.route.routeToken === token) return true;
  const index = session.computeRoutes?.findIndex((route) => route.routeToken === token) ?? -1;
  if (index < 0) return false;
  selectRouteAt(index);
  return true;
}

/** 開始導航有些部分稍後才完成（導航畫面接手室內步驟）；等到真的開始才回報。 */
const START_SETTLE_MS = 6_000;

function started(indoor: boolean): Promise<boolean> {
  const done = () => (indoor ? indoorGuiding() : useNavStore.getState().isNavigating);
  if (done()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      offNav();
      offIndoor();
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), START_SETTLE_MS);
    const offNav = useNavStore.subscribe(() => { if (done()) finish(true); });
    const offIndoor = useIndoorStore.subscribe(() => { if (done()) finish(true); });
  });
}

async function startFromAssistant(token: string | undefined): Promise<VoiceUiCommandResult> {
  const nav = useNavStore.getState();
  if (nav.isNavigating && !nav.arrived && (!token || routeToken() === token)) return { ok: true, guidance: nav.stepMode };
  if (!token) return { ok: false, reason: 'NO_ROUTE' };
  if (nav.isNavigating) endNavigation();
  if (!selectRouteByToken(token)) return { ok: false, reason: 'ROUTE_NOT_FOUND' };
  closeChat();
  const indoor = Boolean(getRouteSessionSnapshot().indoorRoute);
  beginJourney({ notificationTitle: translate('nativeNavNotificationTitle'), notificationBody: translate('nativeNavNotificationBody') });
  if (!(await started(indoor))) return { ok: false, reason: 'NAVIGATION_NOT_STARTED' };
  return { ok: true, guidance: indoor ? 'indoor' : startedGuidance() };
}

/** 後端 `ui.command`：和按鈕走同一個函式，回報實際做了什麼。 */
export async function handleVoiceUiCommand(command: VoiceUiCommand): Promise<VoiceUiCommandResult> {
  switch (command.action) {
    case 'start':
      return startFromAssistant(command.routeToken);
    case 'stop':
      if (indoorGuiding()) useIndoorStore.getState().endGuidance();
      endNavigation();
      return { ok: true };
    case 'advance':
      if (!indoorGuiding()) return { ok: false, reason: 'NOT_AN_INDOOR_STEP' };
      useIndoorStore.getState().confirmStep();
      return { ok: true };
    case 'repeat': {
      const state = currentNavigationState();
      const step = state.active ? state.steps?.[state.currentStepIndex ?? 0] : undefined;
      if (!step) return { ok: false, reason: 'NO_ACTIVE_NAVIGATION' };
      uplink?.sendNavigationCue(step.instruction);
      return { ok: true };
    }
  }
}

/** 文字助理的開始／結束導航：`routeId` 省略＝目前選定路線。 */
export function runNavigationControl(command: { action: 'start'; routeId?: string } | { action: 'stop' }): Promise<VoiceUiCommandResult> {
  if (command.action === 'stop') return handleVoiceUiCommand({ action: 'stop' });
  const session = getRouteSessionSnapshot();
  const route = command.routeId
    ? session.computeRoutes?.find((candidate) => candidate.routeId === command.routeId)
    : (session.navigationRoute ?? session.selectRoute)?.route;
  return startFromAssistant(route?.routeToken);
}

/** 後端只為警報送來的導航事件：advisory 與原因式改道，套用到 App 自己的引擎。 */
export function handleVoiceNavigationEvent(event: VoiceNavigationEvent): void {
  const nav = useNavStore.getState();
  switch (event.type) {
    case 'nav.rerouting':
      handleVoiceRerouteEvent({
        type: 'nav.rerouting',
        navigationId: event.navigationId,
        previousRouteVersion: event.previousRouteVersion,
        reason: event.reason,
      });
      return;
    case 'nav.route_replaced':
      handleVoiceRerouteEvent({
        type: 'nav.route_replaced',
        replacement: {
          navigationId: event.navigationId,
          previousRouteVersion: event.previousRouteVersion,
          routeVersion: event.routeVersion,
          routeToken: event.routeToken,
          route: event.route,
          instructions: event.instructions ?? [],
          warnings: event.warnings,
          currentStepIndex: event.currentStepIndex,
          reason: event.reason,
        },
      });
      return;
    case 'nav.reroute_failed':
      handleVoiceRerouteEvent({
        type: 'nav.reroute_failed',
        navigationId: event.navigationId,
        previousRouteVersion: event.previousRouteVersion,
        message: event.message,
        retryable: event.retryable,
      });
      return;
    case 'nav.advisory': {
      const { navigationId, routeVersion } = routeIdentity();
      if (!shouldAcceptAdvisoryEvent(event, { isNavigating: nav.isNavigating, arrived: nav.arrived, navigationId, routeVersion })) return;
      nav.pushAdvisories(event.advisories);
      const critical = event.advisories.find((advisory) => advisory.severity === 'critical');
      if (critical) notice(critical.title);
      return;
    }
    default:
      return;
  }
}

/** 掛一次（controller 建立時）。 */
export function installVoiceNavigationBridge(target: VoiceNavigationUplink): void {
  uplink = target;
  if (installed) return;
  installed = true;

  // 導航中的路線換了（偏航重算、警報改道）→ 讓後端跟上同一條路線偵測警報
  subscribeRouteSession((state, previous) => {
    if (!useNavStore.getState().isNavigating) return;
    if (state.navigationRoute?.route.routeToken !== previous.navigationRoute?.route.routeToken) uplink?.setNavigationRoute(routeToken());
  });

  useUserLocationStore.subscribe((state, previous) => {
    const position = state.position;
    if (!position || position === previous.position || !voiceLive()) return;
    if (lastSent && haversineMeters(lastSent, position) < POSITION_MIN_DISTANCE_M) return;
    lastSent = position;
    uplink?.sendNavigationPosition(positionPayload(position));
  });

  appStateVisibility.subscribe((active) => {
    if (active) lastSent = null;
  });

  useNavStore.subscribe((state, previous) => {
    if (previous.isNavigating && !state.isNavigating) {
      // 不論按鈕或助理結束：後端停止追蹤
      if (voiceLive()) uplink?.cancelNavigation();
      lastSent = null;
    }
    const changed = state.isNavigating !== previous.isNavigating || state.currentStepIndex !== previous.currentStepIndex
      || state.stepMode !== previous.stepMode || state.arrived !== previous.arrived || state.instructions !== previous.instructions
      // 等車卡片的分鐘數或預計時間變了：助理被問到時要跟畫面一致。
      || state.transitGuide !== previous.transitGuide;
    if (changed) publishState(true);
    else if (state.distanceToNextM !== previous.distanceToNextM) publishState(false);
  });

  useIndoorStore.subscribe((state, previous) => {
    if (state.guidance !== previous.guidance) publishState(true);
  });

  configureNavigationSpeechOwner({
    // 開始導航（按鈕或助理）：告訴後端這條路線與目前位置，以便偵測沿路警報
    prepareNavigation: () => {
      const token = routeToken();
      if (!token || !voiceLive()) return;
      const position = useUserLocationStore.getState().position;
      lastSent = position;
      uplink?.startNavigation(token, position ? positionPayload(position) : undefined);
    },
    cueChannelLive: voiceLive,
    // 助理靜音時吞掉這句，不改由本機 TTS 念（不會兩個聲音）
    speakCue: (text) => {
      if (!voiceLive()) return false;
      if (!useVoiceStore.getState().isMuted) uplink?.sendNavigationCue(text);
      return true;
    },
    geminiOwnsSpeech: () => false,
    geminiMuted: () => useVoiceStore.getState().isMuted,
    subscribe: () => () => {},
    toggleGeminiMute: () => {},
  });
}

/** 語音 session 就緒（含重連）：補送目前路線與導航狀態。 */
export function onVoiceSessionReady(): void {
  lastSent = null;
  if (useNavStore.getState().isNavigating) {
    const token = routeToken();
    const position = useUserLocationStore.getState().position;
    if (token) uplink?.startNavigation(token, position ? positionPayload(position) : undefined);
  }
  publishState(true);
}

export function setBridgeTranslate(t: Translate): void {
  translate = t;
}
