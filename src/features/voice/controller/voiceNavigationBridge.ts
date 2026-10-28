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
  useNavStore,
} from '@/features/navigation';
import { getRouteSessionSnapshot, replaceNavigationRoute, selectRouteAt, subscribeRouteSession } from '@/features/route';
import { haversineMeters, type LatLng } from '@/shared/geo';
import { appStateVisibility } from '@/shared/polling';

import { toNavProgressUpdate } from '../domain/navProgress';
import { toNavInstruction } from '../domain/voiceNavInstruction';
import { handleNavigationExit } from '../domain/voiceNavigationExit';
import {
  filterApplicableNavigationEvents,
  isVoiceSpeechChannelLive,
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
  startNavigation(routeToken: string, position?: VoiceNavigationPosition): void;
  sendNavigationPosition(position: VoiceNavigationPosition): void;
  previewNavigationStep(index: number): void;
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
let manualStartPending = false;
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
  const token = (getRouteSessionSnapshot().navigationRoute ?? getRouteSessionSnapshot().selectRoute)?.route.routeToken;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

function routeIdentity(): { navigationId: string | null; routeVersion: number } {
  const route = (getRouteSessionSnapshot().navigationRoute ?? getRouteSessionSnapshot().selectRoute)?.route;
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

function resumedTransit(event: Extract<VoiceNavigationEvent, { type: 'nav.resume_ok' }>): ReturnType<typeof useNavStore.getState>['voiceTransit'] {
  if (!event.onVehicle) return null;
  const step = event.steps[event.currentStepIndex];
  const route = getRouteSessionSnapshot().navigationRoute?.route;
  const leg = route?.navigationId === event.navigationId && route.routeVersion === event.routeVersion && step?.legIndex != null
    ? route.legs[step.legIndex]
    : null;
  if (!leg || leg.type !== step?.legType) return { onVehicle: true, leg: null };
  switch (leg.type) {
    case 'BUS':
      return { onVehicle: true, leg: { mode: leg.type, from: leg.departureStop, to: leg.arrivalStop, routeName: leg.routeName } };
    case 'METRO':
      return { onVehicle: true, leg: { mode: leg.type, from: leg.departureStation, to: leg.arrivalStation, routeName: leg.lineName,
        ...(leg.terminalStation ? { terminalStation: leg.terminalStation } : {}),
        // 只帶標籤與來源英文名，不帶舊的 display 字：恢復後 HUD 依「現在」的介面語言重新選字。
        ...Object.fromEntries(([
          ['lineKey', leg.lineKey],
          ['fromNameEn', leg.fromNameEn],
          ['toNameEn', leg.toNameEn],
          ['terminalNameEn', leg.terminalStation ? leg.terminalNameEn : undefined],
        ] as const).filter(([, value]) => value?.trim())) } };
    case 'TRA':
    case 'THSR':
      return { onVehicle: true, leg: { mode: leg.type, from: leg.departureStation, to: leg.arrivalStation, routeName: leg.trainNo } };
    default:
      return { onVehicle: true, leg: null };
  }
}

function handBackToLocal(muted = useVoiceStore.getState().isMuted): void {
  const nav = useNavStore.getState();
  nav.setVoiceEnabled(!muted);
  nav.setVoiceTransit(null);
  nav.setNavigationSource('local');
  manualStartPending = false;
  lastSent = null;
  serverStopped = false;
}

/**
 * 語音指定的候選（例：「導航 30 號那條」）不是畫面選的那條時，先切過去，地圖與 HUD 才會跟後端的步驟一致。
 * 正在導航別條（本機導航）或畫面沒有這條時切不過去，回 false。
 */
function showStartedRoute(token: string | undefined): boolean {
  if (!token) return true;
  const session = getRouteSessionSnapshot();
  if (useNavStore.getState().isNavigating) return (session.navigationRoute ?? session.selectRoute)?.route.routeToken === token;
  if (session.selectRoute?.route.routeToken === token) return true;
  const index = session.computeRoutes?.findIndex((route) => route.routeToken === token) ?? -1;
  if (index < 0) return false;
  selectRouteAt(index);
  return true;
}

function startVoiceNavigation(event: Extract<VoiceNavigationEvent, { type: 'nav.start' }>): void {
  manualStartPending = false;
  if (!showStartedRoute(event.routeToken)) {
    // 不接手畫面對不上的路線；請後端取消，免得它對著另一條路線播報
    uplink?.cancelNavigation();
    return;
  }
  const nav = useNavStore.getState();
  const instructions = event.steps.map(toNavInstruction);
  const totalM = event.steps.reduce((sum, step) => sum + (step.distanceM ?? 0), 0);
  const route = (getRouteSessionSnapshot().navigationRoute ?? getRouteSessionSnapshot().selectRoute)?.route;
  // 先切來源再切 isNavigating：導航 controller 啟動時就看到「語音擁有」，不會搶播第一步
  nav.setNavigationSource('voice');
  nav.setVoiceTransit(null);
  nav.setNavigationIdentity(route?.navigationId ?? null, route?.routeVersion ?? 0);
  nav.setInstructions(instructions, [], event.currentStepIndex);
  nav.setDistanceToNextM(event.steps[event.currentStepIndex]?.distanceM ?? null);
  nav.setRouteTotalM(totalM || null);
  nav.setRemainingM(totalM || null);
  lastSent = null;
  serverStopped = false;
  // 與語音規劃路線（openRoutePanel）一致：關掉聊天 modal 讓使用者看到導航，語音改由浮動 pill 延續
  closeChat();
  if (!nav.isNavigating) {
    beginNavigation({
      notificationTitle: translate('nativeNavNotificationTitle'),
      notificationBody: translate('nativeNavNotificationBody'),
    });
  }
  useNavStore.getState().setVoiceEnabled(false);
  const position = useUserLocationStore.getState().position;
  if (position) {
    lastSent = position;
    uplink?.sendNavigationPosition(positionPayload(position));
  }
}

function handleEvent(event: VoiceNavigationEvent): void {
  const nav = useNavStore.getState();
  if (['nav.step', 'nav.transit', 'nav.offroute', 'nav.arrived', 'nav.stop'].includes(event.type) &&
      (!nav.isNavigating || nav.navigationSource !== 'voice')) return;
  switch (event.type) {
    case 'nav.start':
      startVoiceNavigation(event);
      return;
    case 'nav.step': {
      const step = nav.instructions[event.currentStepIndex];
      if (!step || step.type === 'transit_alight' || !['BUS', 'METRO', 'TRA', 'THSR'].includes(step.legType)) nav.setVoiceTransit(null);
      nav.applyVoiceStep(event.currentStepIndex, event.instruction, event.remainingM);
      return;
    }
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
    case 'nav.transit':
      nav.setVoiceTransit({ onVehicle: true, leg: event.leg });
      return;
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
      if (nav.navigationId === event.navigationId && nav.routeVersion === event.previousRouteVersion) nav.setVoiceTransit(null);
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
      nav.setVoiceEnabled(false);
      nav.setInstructions(event.steps.map(toNavInstruction), [], event.currentStepIndex);
      {
        const active = getRouteSessionSnapshot().navigationRoute?.route;
        if (active?.navigationId === event.navigationId && active.routeVersion === event.routeVersion) {
          replaceNavigationRoute({ ...active, routeToken: event.routeToken });
        }
        const distances = event.steps.map((step) => step.distanceM);
        const trustedDistances = distances.length > 0 && distances.every((distance) => distance != null && Number.isFinite(distance) && distance >= 0);
        nav.setRouteTotalM(trustedDistances ? distances.reduce<number>((sum, distance) => sum + (distance ?? 0), 0) : null);
        nav.setRemainingM(trustedDistances ? distances.slice(event.currentStepIndex).reduce<number>((sum, distance) => sum + (distance ?? 0), 0) : null);
        const nextM = event.steps[event.currentStepIndex]?.distanceM;
        nav.setDistanceToNextM(nextM != null && Number.isFinite(nextM) && nextM >= 0 ? nextM : null);
        nav.setVoiceTransit(resumedTransit(event));
      }
      serverStopped = false;
      lastSent = null;
      return;
    case 'nav.resume_failed': {
      if (!voiceNavigationActive() || !nav.navigationId || event.navigationId !== nav.navigationId) return;
      handBackToLocal();
      notice(event.message);
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
      if (manualStartPending) handBackToLocal();
      notice(event.message);
      return;
  }
}

/** controller 的 `onNavigationEvent`：先依語音狀態過濾（語音通道不在時，播報型事件不接），再逐一套用。 */
export function handleVoiceNavigationEvent(event: VoiceNavigationEvent, status: VoiceStatusName): void {
  for (const applicable of filterApplicableNavigationEvents([event], status)) handleEvent(applicable);
}

/** 語音 session 結束（ended／needs-login／error）時，語音擁有的導航交回本機繼續（Web Host status effect）。 */
export function onVoiceSessionTerminal(handoff?: { muted: boolean; reason: 'ended' | 'lost' }): void {
  const nav = useNavStore.getState();
  if (nav.navigationSource === 'voice' && nav.isNavigating) {
    handBackToLocal(handoff?.muted);
    if (handoff?.reason !== 'ended') notice(translate('voiceAssistantLostNavContinues'));
  }
}

/**
 * 掛一次（controller 建立時）。位置供一般語音查詢及導航共用；session 閒置時不上傳。
 */
export function installVoiceNavigationBridge(target: VoiceNavigationUplink): void {
  uplink = target;
  if (installed) return;
  installed = true;

  // 選到的路線換了（含語音改道 replaceSelectedRoute）→ 重新 arm；controller 會在 session.ready 後補送
  subscribeRouteSession((state, previous) => {
    const next = state.navigationRoute ?? state.selectRoute;
    const prev = previous.navigationRoute ?? previous.selectRoute;
    if (next?.route.routeToken !== prev?.route.routeToken) uplink?.setNavigationRoute(routeToken());
  });

  useUserLocationStore.subscribe((state, previous) => {
    const position = state.position;
    if (!position || position === previous.position || !isVoiceSpeechChannelLive(uplink?.getStatus() ?? 'idle')) return;
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
    manualStartPending = false;
  });

  // 喇叭仲裁：語音擁有導航且語音通道活著時，本機 TTS 讓位；HUD 喇叭鈕改切語音助理靜音
  configureNavigationSpeechOwner({
    prepareNavigation: () => {
      const nav = useNavStore.getState();
      const token = routeToken();
      if (nav.navigationSource === 'voice' || !token || !uplink || !isVoiceSpeechChannelLive(uplink.getStatus())) return;
      nav.setNavigationSource('voice');
      nav.setVoiceEnabled(false);
      manualStartPending = true;
      serverStopped = false;
      const position = useUserLocationStore.getState().position;
      lastSent = position;
      uplink.startNavigation(token, position ? positionPayload(position) : undefined);
    },
    previewStep: (index) => {
      if (voiceNavigationActive() && isVoiceSpeechChannelLive(uplink?.getStatus() ?? 'idle')) uplink?.previewNavigationStep(index);
    },
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
