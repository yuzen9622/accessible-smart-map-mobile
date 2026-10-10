// 移植自 Web `src/components/Voice/VoiceFloatingIndicator.tsx`（commit f5027af）的純函式部分：
// `isVoiceSessionActive`、`shouldShowVoicePill`、`getVoiceStatusLabel`。元件本體（DOM／Tailwind）不移植。
// 差異：`getVoiceStatusLabel` 的 `t` 改為注入的 `Translate`（無 fallback 參數），key 沿用既有的 `chatbot.voice.*`。
import type { Translate } from '@/features/ai/domain';

import type { VoiceViewMode } from './voiceViewState';
import type { VoiceStatus, VoiceStatusName } from './voiceSession';

/**
 * Single centralized definition of "the voice session is active" (plan
 * §5.6 privacy invariant). The indicator and the chat panel's panel-vs-text
 * decision must use this exact function so they can never disagree.
 */
export function isVoiceSessionActive(status: VoiceStatusName): boolean {
  return status !== 'idle' && status !== 'ended';
}

/**
 * The pill must show whenever a session is active AND the voice view isn't
 * already on screen inside the chat panel (panel closed, or panel open but
 * showing the text-chat surface instead of the voice view).
 */
export function shouldShowVoicePill(status: VoiceStatusName, chatOpen: boolean, viewMode: VoiceViewMode): boolean {
  return isVoiceSessionActive(status) && (!chatOpen || viewMode !== 'panel');
}

/** needs-login／error 之後控制器已無東西可拆，UI 的「結束」只是回到 idle。 */
export function isTerminalVoiceStatus(status: VoiceStatusName): boolean {
  return status === 'needs-login' || status === 'error';
}

/** Status → label（關閉碼專屬文案：needs-login／4409／1011／live-session-ended／MIC_UNAVAILABLE）。 */
export function getVoiceStatusLabel(status: VoiceStatus, t: Translate): string {
  switch (status.status) {
    case 'idle':
      return t('chatbot.voice.statusIdle');
    case 'connecting':
      return t('chatbot.voice.statusConnecting');
    case 'ready':
      return t('chatbot.voice.statusReady');
    case 'listening':
      return t('chatbot.voice.statusListening');
    case 'model-speaking':
      return t('chatbot.voice.statusModelSpeaking');
    case 'reconnecting':
      return t('chatbot.voice.statusReconnecting');
    case 'playback-blocked':
      return t('chatbot.voice.statusPlaybackBlocked');
    case 'needs-login':
      return t('chatbot.voice.statusNeedsLogin');
    case 'ended':
      return t('chatbot.voice.statusEnded');
    case 'error':
      if (status.code === 4409) return t('chatbot.voice.errorConflict');
      if (status.code === 'LIVE_SESSION_ENDED') return t('chatbot.voice.errorSessionEnded');
      if (status.code === 'LIVE_CONNECT_FAILED') return t('chatbot.voice.errorServer');
      if (status.code === 'ROUTE_RESPONSE_INVALID') return t('chatbot.voice.errorRouteResponse');
      if (status.code === 1011) return t('chatbot.voice.errorServer');
      if (status.code === 'MIC_UNAVAILABLE') return t('chatbot.voice.errorMic');
      return t('chatbot.voice.errorGeneric');
    default:
      return t('chatbot.voice.statusIdle');
  }
}
