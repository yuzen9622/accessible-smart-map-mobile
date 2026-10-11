import { isDevice } from 'expo-device';
import { AccessibilityInfo, Platform } from 'react-native';

import {
  appendVoiceTurns,
  getRouteConversationRequest,
  executeAction,
  getVoiceHistory,
  type Translate,
} from '@/features/ai';
import { VOICE_HISTORY_LIMIT } from '@/features/ai/domain';
import { useAuthStore } from '@/features/auth';
import { useUserLocationStore } from '@/features/map';
import { getRouteSessionSnapshot, subscribeRouteSession, invalidateRouteConversations, markRouteTokenInvalid } from '@/features/route';
import { getAuthPort } from '@/shared/api';
import { getLocationPort } from '@/shared/location';
import i18n, { getAppLanguage } from '@/shared/i18n';

import { createCapture } from '../audio/audioCapture';
import { createPlayback } from '../audio/audioPlayback';
import { beginVoiceAudio, releaseVoiceAudio } from '../audio/audioSession';
import { createEchoGate } from '../domain/echoGate';
import { buildVoiceTurns, toolMarkOf, voiceTurnsToPriorTurns, type VoiceToolMark } from '../domain/voiceConversation';
import { createVoiceBindings, type VoiceBindings } from '../domain/voiceSessionBindings';
import { VoiceSessionController, type VoiceStatus } from '../domain/voiceSession';
import { getVoiceStatusLabel } from '../domain/voiceStatus';
import { reduceSessionBoundary, reduceStatus, reduceToggleMute } from '../domain/voiceViewState';
import { voiceLevels } from '../store/voiceLevels';
import { useVoiceStore } from '../store/voiceStore';
import { createVoiceSocket, voiceWsUrl } from '../transport/voiceSocket';
import {
  armCurrentRoute,
  getVoiceNavigationResumeState,
  handleVoiceNavigationEvent,
  installVoiceNavigationBridge,
  onVoiceSessionTerminal,
  setBridgeTranslate,
} from './voiceNavigationBridge';

/**
 * 語音對話的 controller（對應 Web `src/hook/useVoiceSession.ts`＋`VoiceSessionHost` 的 session 部分）。
 *
 * 模組層單例：語音 session 跨畫面存活（關掉聊天 modal、切到路線面板時仍在對話），UI 只讀 `useVoiceStore`。
 * - 聊天與語音共用已驗證的路線 action；成功套用同一份結果後才切路線面板。
 * - 登出或換帳號時結束 session（Web `useAuthStore.subscribe`）。
 * - 結束（ended／error／needs-login）時釋放 audio session，把喇叭交還導航 TTS。
 *
 * - 語音導航交接（`nav.*` 事件、路線 arm、位置上行、`nav.resume`、喇叭仲裁）在 `voiceNavigationBridge.ts`。
 */

let controller: VoiceSessionController | null = null;
let bindings: VoiceBindings | null = null;
let translate: Translate = (key) => key;
let identityAtStart: string | null = null;
let lastAnnounced = '';
/** 這段語音的工具結果（併回文字對話用）；`merged` 確保一段 session 只併一次。 */
let toolMarks: VoiceToolMark[] = [];
let merged = true;
/**
 * iOS 真機用 voiceChat + 原生 voice processing 消除回音，助理播放中仍送麥克風資料以支援插話。
 * 原生補丁在 voice processing 啟用失敗時拒絕開始錄音，不會偷偷退回未處理的收音。
 * 模擬器的 AEC 曾實測無效，Android 尚未接入 AEC，兩者保留半雙工。此能力不隨 session 改變。
 */
let gateForward: (frame: ArrayBuffer) => void = () => {};
const echoGate = createEchoGate({
  now: () => Date.now(),
  forward: (frame) => gateForward(frame),
  echoCancellationEnabled: Platform.OS === 'ios' && isDevice,
});

function currentIdentity(): string | null {
  return useAuthStore.getState().user?._id ?? null;
}

function announce(status: VoiceStatus): void {
  const label = getVoiceStatusLabel(status, translate);
  if (label === lastAnnounced) return;
  lastAnnounced = label;
  AccessibilityInfo.announceForAccessibility(label);
}

function currentVoiceTurns() {
  return buildVoiceTurns(useVoiceStore.getState().transcripts, toolMarks);
}

/** 語音結束：逐字稿與工具結果接到文字對話後面，之後打字時 AI 接得上剛才講的。 */
function mergeIntoChat(): void {
  if (merged) return;
  merged = true;
  appendVoiceTurns(currentVoiceTurns());
  toolMarks = [];
}

/** 送 `session.start`（含重連）時的對話脈絡：先前打字的內容＋這段語音已經講過的。 */
function sharedHistory() {
  return [...getVoiceHistory(), ...voiceTurnsToPriorTurns(currentVoiceTurns())].slice(-VOICE_HISTORY_LIMIT);
}

function onStatus(status: VoiceStatus): void {
  useVoiceStore.setState((state) => reduceStatus(state, status));
  // 只播報使用者需要知道的轉折，不逐一念 listening／model-speaking（會蓋過模型語音）
  if (['connecting', 'reconnecting', 'needs-login', 'ended', 'error'].includes(status.status)) announce(status);
  if (status.status === 'ended' || status.status === 'error' || status.status === 'needs-login') {
    useVoiceStore.setState({ activeTool: null, routeSyncState: 'idle' });
    mergeIntoChat();
    releaseVoiceAudio();
    onVoiceSessionTerminal();
  }
}

function ensureController(): { controller: VoiceSessionController; bindings: VoiceBindings } {
  if (controller && bindings) return { controller, bindings };
  const b = createVoiceBindings({
    publishTranscripts: (entries) => useVoiceStore.setState({ transcripts: entries }),
    publishStatus: onStatus,
    publishTool: (event) => {
      const mark = toolMarkOf(event, useVoiceStore.getState().transcripts.length);
      if (mark) toolMarks.push(mark);
      useVoiceStore.setState({ activeTool: event });
    },
    setMicLevel: (level) => voiceLevels.mic.set(level),
    executeAction,
    getRouteGeneration: () => getRouteSessionSnapshot().selectionGeneration,
    onRouteError: () => controller?.rejectRouteResponse(),
    get t() {
      return translate;
    },
  });
  const c = new VoiceSessionController({
    wsUrl: voiceWsUrl(),
    createSocket: createVoiceSocket,
    refreshAuth: async () => {
      const port = getAuthPort();
      return port.refresh(port.getSession());
    },
    getToken: () => getAuthPort().getSession()?.accessToken,
    getAuthIdentity: currentIdentity,
    getUserLocation: () => {
      const position = useUserLocationStore.getState().position;
      return position ? { latitude: position.lat, longitude: position.lng } : null;
    },
    requestUserLocation: async () => {
      const location = getLocationPort();
      if (await location.getPermissionStatus() !== 'granted') return null;
      const position = await location.getCurrent({ accuracy: 'high' });
      return { latitude: position.lat, longitude: position.lng };
    },
    getHistory: sharedHistory,
    getLanguage: getAppLanguage,
    getRouteConversation: getRouteConversationRequest,
    onInvalidRouteToken: markRouteTokenInvalid,
    onRouteSyncState: (routeSyncState) => useVoiceStore.setState({ routeSyncState }),
    createCapture: (onFrame) => {
      echoGate.clear();
      gateForward = onFrame;
      return createCapture(b.wrapCaptureFrame((frame) => echoGate.push(frame)));
    },
    createPlayback: () =>
      createPlayback({
        onScheduled: (ms) => echoGate.notePlayback(ms),
        onCleared: () => echoGate.clear(),
        onLevel: (level) => voiceLevels.model.set(level),
      }),
    onStatusChange: b.onStatusChange,
    onTranscript: b.onTranscript,
    onTranscriptCorrection: b.onTranscriptCorrection,
    onTurnComplete: b.onTurnComplete,
    onInterrupted: b.onInterrupted,
    onToolEvent: b.onToolEvent,
    onNavigationEvent: (event) => handleVoiceNavigationEvent(event, c.getStatus().status),
    getNavigationResumeState: getVoiceNavigationResumeState,
  });
  subscribeRouteSession((state, previous) => {
    if (state.selectRoute?.route !== previous.selectRoute?.route || state.isLoading !== previous.isLoading || state.invalidRouteTokens !== previous.invalidRouteTokens) c.syncRouteContext();
  });
  controller = c;
  i18n.on('languageChanged', () => c.syncLanguage());
  bindings = b;
  installVoiceNavigationBridge({
    setNavigationRoute: (token) => c.setNavigationRoute(token),
    sendNavigationPosition: (position) => c.sendNavigationPosition(position),
    cancelNavigation: () => c.cancelNavigation(),
    setMuted: setVoiceMuted,
    getStatus: () => c.getStatus().status,
  });
  return { controller: c, bindings: b };
}

// 登出／換帳號：結束進行中的 session（語音 token 只在握手時驗證一次，後端不會替我們斷線）
useAuthStore.subscribe((state) => {
  const status = useVoiceStore.getState().status.status;
  if (status === 'idle' || status === 'ended') return;
  const identity = state.user?._id ?? null;
  if (!state.session || identity !== identityAtStart) {
    // The login notice stays visible; the previous account's conversation must
    // not remain on that surface or be merged into a new account's chat.
    merged = true;
    toolMarks = [];
    bindings?.reset();
    controller?.requireLogin();
  }
});

export function startVoiceSession(t: Translate): void {
  translate = t;
  setBridgeTranslate(t);
  lastAnnounced = '';
  const { controller: c, bindings: b } = ensureController();
  identityAtStart = currentIdentity();
  beginVoiceAudio();
  // 上一段若沒走到結束狀態（例如 App 直接關掉 modal）也先併回去，再從乾淨的逐字稿開始
  mergeIntoChat();
  b.reset();
  toolMarks = [];
  merged = false;
  useVoiceStore.setState((state) => ({ ...reduceSessionBoundary(state), routeSyncState: 'idle', activeTool: null, viewMode: 'panel' }));
  armCurrentRoute();
  c.start();
}

export function endVoiceSession(): void {
  controller?.end();
  invalidateRouteConversations();
  useVoiceStore.setState((state) => reduceSessionBoundary(state));
}

/** needs-login／error 之後控制器已無東西可拆：UI 的「關閉」只把畫面回到 idle。 */
export function dismissVoiceSession(): void {
  controller?.end();
  useVoiceStore.setState((state) => ({ ...reduceSessionBoundary(state), status: { status: 'idle' }, activeTool: null }));
}

function setVoiceMuted(muted: boolean): void {
  useVoiceStore.setState({ isMuted: muted });
  controller?.setMuted(muted);
  bindings?.setMuted(muted);
}

export function toggleVoiceMute(): void {
  setVoiceMuted(reduceToggleMute(useVoiceStore.getState()).isMuted);
}

export function retryRouteContextSync(): void { controller?.syncRouteContext(); }

export function resumeVoicePlayback(): void {
  controller?.resumePlayback();
}
