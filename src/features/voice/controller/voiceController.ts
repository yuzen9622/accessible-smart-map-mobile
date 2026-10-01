import { AccessibilityInfo } from 'react-native';

import { computeRouteAction, executeAction, openRoutePanel, type Translate } from '@/features/ai';
import { useAuthStore } from '@/features/auth';
import { useUserLocationStore } from '@/features/map';
import { getAuthPort } from '@/shared/api';

import { createCapture } from '../audio/audioCapture';
import { createPlayback } from '../audio/audioPlayback';
import { beginVoiceAudio, releaseVoiceAudio } from '../audio/audioSession';
import { createEchoGate } from '../domain/echoGate';
import { createVoiceBindings, type VoiceBindings } from '../domain/voiceSessionBindings';
import { VoiceSessionController, type VoiceStatus } from '../domain/voiceSession';
import { getVoiceStatusLabel } from '../domain/voiceStatus';
import { reduceSessionBoundary, reduceStatus, reduceToggleMute } from '../domain/voiceViewState';
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
 * - 聊天與語音是兩條獨立路徑（SDD §6.6）：工具結果經 bindings 的 `executeAction`，`compute-route` 由這裡 await，
 *   成功才切路線面板（語音沒有 modal 要關，但會蓋掉聊天 modal）。
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
/**
 * 回音閘門（domain/echoGate.ts）：助理語音播放中不把麥克風收到的回音送回後端，否則 Gemini 會把自己的話當成
 * 使用者發言而不停重複回答。播放端回報排程時長／清空，擷取端每個 frame 先過閘門。
 */
let gateForward: (frame: ArrayBuffer) => void = () => {};
const echoGate = createEchoGate({ now: () => Date.now(), forward: (frame) => gateForward(frame) });

function currentIdentity(): string | null {
  return useAuthStore.getState().user?._id ?? null;
}

function announce(status: VoiceStatus): void {
  const label = getVoiceStatusLabel(status, translate);
  if (label === lastAnnounced) return;
  lastAnnounced = label;
  AccessibilityInfo.announceForAccessibility(label);
}

function onStatus(status: VoiceStatus): void {
  useVoiceStore.setState((state) => reduceStatus(state, status));
  // 只播報使用者需要知道的轉折，不逐一念 listening／model-speaking（會蓋過模型語音）
  if (['connecting', 'reconnecting', 'needs-login', 'ended', 'error'].includes(status.status)) announce(status);
  if (status.status === 'ended' || status.status === 'error' || status.status === 'needs-login') {
    releaseVoiceAudio();
    onVoiceSessionTerminal();
  }
}

function ensureController(): { controller: VoiceSessionController; bindings: VoiceBindings } {
  if (controller && bindings) return { controller, bindings };
  const b = createVoiceBindings({
    publishTranscripts: (entries) => useVoiceStore.setState({ transcripts: entries }),
    publishStatus: onStatus,
    publishTool: (event) => useVoiceStore.setState({ activeTool: event }),
    setMicLevel: (level) => useVoiceStore.setState({ micLevel: level }),
    executeAction,
    computeRoute: async (origin, destination) => {
      const result = await computeRouteAction(origin, destination);
      if (result.ok) openRoutePanel();
      return result;
    },
    onComputeRouteError: (error) => console.warn('[voice] compute-route failed', error),
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
    createCapture: (onFrame) => {
      echoGate.clear();
      gateForward = onFrame;
      return createCapture(b.wrapCaptureFrame((frame) => echoGate.push(frame)));
    },
    createPlayback: () =>
      createPlayback({
        onScheduled: (ms) => echoGate.notePlayback(ms),
        onCleared: () => echoGate.clear(),
        onLevel: (level) => useVoiceStore.setState({ modelLevel: level }),
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
  controller = c;
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
  if (!state.session || identity !== identityAtStart) controller?.end();
});

export function startVoiceSession(t: Translate): void {
  translate = t;
  setBridgeTranslate(t);
  lastAnnounced = '';
  const { controller: c, bindings: b } = ensureController();
  identityAtStart = currentIdentity();
  beginVoiceAudio();
  b.reset();
  useVoiceStore.setState((state) => ({ ...reduceSessionBoundary(state), activeTool: null, viewMode: 'panel' }));
  armCurrentRoute();
  c.start();
}

export function endVoiceSession(): void {
  controller?.end();
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

export function resumeVoicePlayback(): void {
  controller?.resumePlayback();
}
