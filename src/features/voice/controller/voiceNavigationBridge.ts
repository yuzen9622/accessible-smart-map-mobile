import { AccessibilityInfo } from 'react-native';

import { closeChat, type Translate } from '@/features/ai';
import { useUserLocationStore } from '@/features/map';
import {
  beginNavigation,
  configureNavigationSpeechOwner,
  endNavigation,
  geminiOwnsNavigationSpeech,
  handleVoiceRerouteEvent,
  localRerouteCoordinator,
  startNavigation,
  useNavStore,
} from '@/features/navigation';
import { getRouteSessionSnapshot, subscribeRouteSession } from '@/features/route';
import { haversineMeters, type LatLng } from '@/shared/geo';
import { appStateVisibility } from '@/shared/polling';

import { toNavProgressUpdate } from '../domain/navProgress';
import { toNavInstruction } from '../domain/voiceNavInstruction';
import { handleNavigationExit } from '../domain/voiceNavigationExit';
import {
  filterApplicableNavigationEvents,
  shouldAcceptAdvisoryEvent,
  type VoiceNavigationEvent,
  type VoiceNavigationPosition,
  type VoiceNavigationResumeState,
  type VoiceStatusName,
} from '../domain/voiceSession';
import { useVoiceStore } from '../store/voiceStore';

/**
 * 語音導航交接（移植自 Web `components/Voice/VoiceSessionHost.tsx` 的導航部分，commit f5027af）。
 * 後端（語音 gateway 的導航狀態機）負責 geofence 推進、改道與播報；這裡只把 `nav.*` 事件寫進 navigation 的 store，
 * 並把路線 token、節流過的位置、離開導航回報給後端。
 *
 * 與 Web 的差異：
 * - 語音叫出的導航用 `beginNavigation`（開導航畫面、背景定位），結束用 `endNavigation`；Web 只切 store。
 * - Web 的 toast 改為 `announceForAccessibility`（本 App 沒有 toast）。
 * - 喇叭仲裁經 navigation 的 `configureNavigationSpeechOwner` port 注入（navigation 不 import voice）。
 */

export interface VoiceNavigationUplink {
  setNavigationRoute(routeToken: string | null): void;
  sendNavigationPosition(position: VoiceNavigationPosition): void;
  cancelNavigation(): void;
  setMuted(muted: boolean): void;
  getStatus(): VoiceStatusName;
}

/** 位置上行的距離節流（Web Host：與上次送出的點相距 < 10 m 不送）。 */
const POSITION_MIN_DISTANCE_M = 10;

let uplink: VoiceNavigationUplink | null = null;
let translate: Translate = (key) => key;
let lastSent: LatLng | null = null;
/** 後端以 `nav.stop(arrived)` 結束導航：離開導航時不再回送 `nav.cancel`。 */
let serverStopped = false;
let installed = false;

function notice(message: string): void {
  if (message) AccessibilityInfo.announceForAccessibility(message);
}

function currentHeading(): number | null {
  const nav = useNavStore.getState();
  return nav.userHeading ?? nav.gpsHeading;
}

function positionPayload(position: LatLng): VoiceNavigationPosition {
  const heading = currentHeading();
  return { latitude: position.lat, longitude: position.lng, ...(heading == null ? {} : { heading }) };
}

function routeToken(): string | null {
  const token = getRouteSessionSnapshot().selectRoute?.route.routeToken;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

function routeIdentity(): { navigationId: string | null; routeVersion: number } {
  const route = getRouteSessionSnapshot().selectRoute?.route;
  const nav = useNavStore.getState();
  return { navigationId: route?.navigationId ?? nav.navigationId, routeVersion: route?.routeVersion ?? nav.routeVersion };
}

function voiceNavigationActive(): boolean {
  const nav = useNavStore.getState();
  return nav.isNavigating && nav.navigationSource === 'voice' && !nav.arrived;
}

/** 重連 `session.ready` 後的 `nav.resume` 內容；不是語音擁有的導航就回 null（不送 resume）。 */
export function getVoiceNavigationResumeState(): VoiceNavigationResumeState | null {
  if (!voiceNavigationActive()) return null;
  const nav = useNavStore.getState();
  const { navigationId, routeVersion } = routeIdentity();
  const token = routeToken();
  if (!navigationId || !token) return null;
  const position = useUserLocationStore.getState().position;
  return {
    navigationId,
    routeVersion,
    routeToken: token,
    lastKnownStepIndex: nav.currentStepIndex,
    ...(position ? { currentPosition: positionPayload(position) } : {}),
  };
}

function startVoiceNavigation(event: Extract<VoiceNavigationEvent, { type: 'nav.start' }>): void {
  const nav = useNavStore.getState();
  const instructions = event.steps.map(toNavInstruction);
  const totalM = event.steps.reduce((sum, step) => sum + (step.distanceM ?? 0), 0);
  const route = getRouteSessionSnapshot().selectRoute?.route;
  // 先切來源再切 isNavigating：導航 controller 啟動時就看到「語音擁有」，不會搶播第一步
  nav.setNavigationSource('voice');
  nav.setNavigationIdentity(route?.navigationId ?? null, route?.routeVersion ?? 0);
  nav.setInstructions(instructions, [], event.currentStepIndex);
  nav.setDistanceToNextM(event.steps[event.currentStepIndex]?.distanceM ?? null);
  nav.setRouteTotalM(totalM || null);
  nav.setRemainingM(totalM || null);
  lastSent = null;
  serverStopped = false;
  // 與語音規劃路線（openRoutePanel）一致：關掉聊天 modal 讓使用者看到導航，語音改由浮動 pill 延續
  closeChat();
  if (nav.isNavigating) {
    startNavigation();
  } else {
    beginNavigation({
      notificationTitle: translate('nativeNavNotificationTitle'),
      notificationBody: translate('nativeNavNotificationBody'),
    });
  }
  // beginNavigation 會打開本機播報；語音助理自己會念，關掉以免重複
  useNavStore.getState().setVoiceEnabled(false);
  const position = useUserLocationStore.getState().position;
  if (position) {
    lastSent = position;
    uplink?.sendNavigationPosition(positionPayload(position));
  }
}

function handleEvent(event: VoiceNavigationEvent): void {
  const nav = useNavStore.getState();
  switch (event.type) {
    case 'nav.start':
      startVoiceNavigation(event);
      return;
    case 'nav.step':
      nav.applyVoiceStep(event.currentStepIndex, event.instruction, event.remainingM);
      return;
    case 'nav.progress': {
      const { navigationId, routeVersion } = routeIdentity();
      if (
        nav.navigationSource === 'voice' &&
        !nav.arrived &&
        navigationId !== null &&
        event.navigationId === navigationId &&
        event.routeVersion === routeVersion
      ) {
        nav.setProgress(toNavProgressUpdate(event));
      }
      return;
    }
    case 'nav.transit': {
      const next = nav.instructions.findIndex((step, index) => index >= nav.currentStepIndex && step.legType === event.leg.mode);
      if (next >= 0) nav.setCurrentStepIndex(next);
      nav.setDistanceToNextM(null);
      return;
    }
    case 'nav.offroute':
      nav.setIsOffRoute(true);
      return;
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
          instructions: event.instructions ?? event.steps.map(toNavInstruction),
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
    case 'nav.resume_ok':
      if (
        !nav.isNavigating ||
        nav.arrived ||
        !nav.navigationId ||
        event.navigationId !== nav.navigationId ||
        event.routeVersion !== nav.routeVersion
      ) {
        return;
      }
      nav.setNavigationSource('voice');
      if (event.steps.length > 0) nav.setInstructions(event.steps.map(toNavInstruction), [], event.currentStepIndex);
      else nav.setCurrentStepIndex(event.currentStepIndex);
      serverStopped = false;
      lastSent = null;
      return;
    case 'nav.resume_failed': {
      if (!nav.isNavigating || nav.arrived) return;
      nav.setNavigationSource('local');
      lastSent = null;
      serverStopped = false;
      notice(translate('voiceReconnectedRerouting'));
      const position = useUserLocationStore.getState().position;
      if (position) void localRerouteCoordinator.triggerAutoReroute(position);
      return;
    }
    case 'nav.advisory': {
      const { navigationId, routeVersion } = routeIdentity();
      if (!shouldAcceptAdvisoryEvent(event, { isNavigating: nav.isNavigating, arrived: nav.arrived, navigationId, routeVersion })) return;
      nav.pushAdvisories(event.advisories);
      const critical = event.advisories.find((advisory) => advisory.severity === 'critical');
      if (critical) notice(critical.title);
      return;
    }
    case 'nav.arrived':
      nav.setArrived(true);
      return;
    case 'nav.stop':
      lastSent = null;
      if (event.reason === 'arrived') {
        serverStopped = true;
        nav.setArrived(true);
      } else if (nav.isNavigating) {
        // 先切回本機，離開導航時才不會回送 nav.cancel
        nav.setNavigationSource('local');
        endNavigation();
      }
      return;
    case 'nav.error':
      nav.setNavigationSource('local');
      if (nav.isNavigating) endNavigation();
      notice(event.message);
      return;
  }
}

/** controller 的 `onNavigationEvent`：先依語音狀態過濾（語音通道不在時，播報型事件不接），再逐一套用。 */
export function handleVoiceNavigationEvent(event: VoiceNavigationEvent, status: VoiceStatusName): void {
  for (const applicable of filterApplicableNavigationEvents([event], status)) handleEvent(applicable);
}

/** 語音 session 結束（ended／needs-login／error）時，語音擁有的導航交回本機繼續（Web Host status effect）。 */
export function onVoiceSessionTerminal(): void {
  const nav = useNavStore.getState();
  if (nav.navigationSource === 'voice' && nav.isNavigating) {
    nav.setNavigationSource('local');
    lastSent = null;
    serverStopped = false;
    notice(translate('voiceAssistantLostNavContinues'));
  }
}

/**
 * 掛一次（controller 建立時）。訂閱全都自己判斷「是否語音擁有導航」，session 閒置時不做事（Web Host 也是常駐）。
 */
export function installVoiceNavigationBridge(target: VoiceNavigationUplink): void {
  uplink = target;
  if (installed) return;
  installed = true;

  // 選到的路線換了（含語音改道 replaceSelectedRoute）→ 重新 arm；controller 會在 session.ready 後補送
  subscribeRouteSession((state, previous) => {
    if (state.selectRoute?.route.routeToken !== previous.selectRoute?.route.routeToken) uplink?.setNavigationRoute(routeToken());
  });

  useUserLocationStore.subscribe((state, previous) => {
    const position = state.position;
    if (!position || position === previous.position || !voiceNavigationActive()) return;
    if (lastSent && haversineMeters(lastSent, position) < POSITION_MIN_DISTANCE_M) return;
    lastSent = position;
    uplink?.sendNavigationPosition(positionPayload(position));
  });

  // 回到前景：下一個位置一律送出（背景期間的 GPS 不一定都有上行）
  appStateVisibility.subscribe((active) => {
    if (active) lastSent = null;
  });

  // 使用者離開導航：語音擁有且不是後端自己結束的，回報 nav.cancel 並解除靜音（Web handleNavigationExit）
  useNavStore.subscribe((state, previous) => {
    if (!previous.isNavigating || state.isNavigating) return;
    handleNavigationExit(
      { navigationSource: previous.navigationSource, serverStopped },
      {
        cancelNavigation: () => uplink?.cancelNavigation(),
        setNavigationSource: (source) => useNavStore.getState().setNavigationSource(source),
        setMuted: (muted) => uplink?.setMuted(muted),
      },
    );
    lastSent = null;
    serverStopped = false;
  });

  // 喇叭仲裁：語音擁有導航且語音通道活著時，本機 TTS 讓位；HUD 喇叭鈕改切語音助理靜音
  configureNavigationSpeechOwner({
    geminiOwnsSpeech: () => geminiOwnsNavigationSpeech(useNavStore.getState().navigationSource, useVoiceStore.getState().status.status),
    geminiMuted: () => useVoiceStore.getState().isMuted,
    subscribe: (onChange) => {
      const offNav = useNavStore.subscribe((state, previous) => {
        if (state.navigationSource !== previous.navigationSource) onChange();
      });
      const offVoice = useVoiceStore.subscribe((state, previous) => {
        if (state.status.status !== previous.status.status || state.isMuted !== previous.isMuted) onChange();
      });
      return () => {
        offNav();
        offVoice();
      };
    },
    toggleGeminiMute: () => uplink?.setMuted(!useVoiceStore.getState().isMuted),
  });
}

/** 新 session 開始：arm 目前選到的路線（controller 保留到 session.ready 再送）。 */
export function armCurrentRoute(): void {
  lastSent = null;
  uplink?.setNavigationRoute(routeToken());
}

export function setBridgeTranslate(t: Translate): void {
  translate = t;
}
