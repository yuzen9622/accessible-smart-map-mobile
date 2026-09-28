// 導航 domain 共用型別。移植自 Web `src/stores/useNavStore.ts` 與 `src/lib/voice/voiceSession.ts`
// （commit 5eadc71）的型別宣告；Web 把它們放在 store／語音 session 裡，本 repo 的 domain 不能 import
// store，所以集中到這裡。語音 feature（Phase 4）移植後，`VoiceStatusName`／`VoiceNavAdvisory` 改由
// `@/features/voice/domain` 提供，這裡轉出以保持相容。

import type { RerouteReason } from '@/features/route/domain';

export type HeadingSource = 'compass' | 'gps' | null;
export type NavigationSource = 'local' | 'voice';
export type RerouteStatus = 'idle' | 'pending' | 'error';
export type NavViewMode = '3d' | '2d';
export type EtaSource = 'schedule' | 'realtime' | 'free_flow' | 'estimated' | 'local' | null;

export type NavRerouteReason = RerouteReason;

/** 語音 session 狀態（Web `VoiceStatusName`）。 */
export type VoiceStatusName =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'listening'
  | 'model-speaking'
  | 'reconnecting'
  | 'playback-blocked'
  | 'needs-login'
  | 'ended'
  | 'error';

/** 語音通道能不能承載說話（Web `isVoiceSpeechChannelLive`，逐行移植）。 */
export function isVoiceSpeechChannelLive(status: VoiceStatusName): boolean {
  return status === 'ready' || status === 'listening' || status === 'model-speaking' || status === 'playback-blocked';
}

/** 導航中的主動警報（Web `VoiceNavAdvisory`）。 */
export interface NavAdvisory {
  advisoryId: string;
  category: 'facility' | 'transit_alert' | 'hazard' | 'traffic';
  severity: 'info' | 'warning' | 'critical';
  action: 'none' | 'reroute_suggested' | 'reroute_applied';
  title: string;
  detail?: string;
  speech: string;
  rerouteReason?: NavRerouteReason;
  location?: { latitude: number; longitude: number };
  distanceAheadM?: number;
  issuedAt: string;
}
