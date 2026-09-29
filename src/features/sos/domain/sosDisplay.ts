import type { EmergencyContact, HandlingStatus, SosSnapshot, SosTimelineType, SosType } from './types';

/** 顯示用 helper，對齊 Web `SosDialog.tsx`／`SosTrackerWrapper.tsx`（commit f82cda8）的 i18n key 對照。 */

export const HANDLING_LABEL_KEY: Record<HandlingStatus, string> = {
  notified: 'sosHandlingNotified',
  acknowledged: 'sosHandlingAcknowledged',
  claimed: 'sosHandlingClaimed',
  en_route: 'sosHandlingEnRoute',
  arrived: 'sosHandlingArrived',
  resolved: 'sosHandlingResolved',
};

export const TIMELINE_LABEL_KEY: Record<SosTimelineType, string> = {
  created: 'sosTimelineCreated',
  notified: 'sosTimelineNotified',
  acknowledged: 'sosTimelineAcknowledged',
  claimed: 'sosTimelineClaimed',
  status_update: 'sosTimelineStatusUpdate',
  resolved: 'sosTimelineResolved',
};

export const SOS_TYPE_LABEL_KEY: Record<SosType, string> = {
  body: 'sosBodyDiscomfort',
  trapped: 'sosTrapped',
  share_location: 'sosShareLocationType',
};

export type HandlingSummary =
  | { kind: 'handler'; name: string; statusKey: string }
  | { kind: 'acks'; count: number }
  | { kind: 'sharing' };

/** 標頭一行摘要：有人接手 → 「名字・狀態」；否則有人已讀 → 已讀人數；否則「持續分享位置中」。 */
export function handlingSummary(snapshot: SosSnapshot | null): HandlingSummary {
  if (snapshot?.claimedByName) {
    return { kind: 'handler', name: snapshot.claimedByName, statusKey: HANDLING_LABEL_KEY[snapshot.handlingStatus] };
  }
  const count = snapshot?.acknowledgements.length ?? 0;
  if (count > 0) return { kind: 'acks', count };
  return { kind: 'sharing' };
}

export function boundContactNames(contacts: EmergencyContact[]): string[] {
  return contacts.filter((c) => c.bindStatus === 'bound').map((c) => c.name);
}

/**
 * 分享給其他人的追蹤連結：Web 追蹤頁讀 `?sos=`，後端公開端點以 shareToken 為 key（Web 目前仍帶 sessionId，
 * 那是改版前的舊契約，舊連結後端已失效）。
 */
export function buildSosShareUrl(shareBaseUrl: string, language: string, shareToken: string): string {
  const base = shareBaseUrl.replace(/\/+$/, '');
  return `${base}/${language}?sos=${encodeURIComponent(shareToken)}`;
}

/** 深層連結 `accessiblesmartmap://sos-track/<token>` 或 Web 分享連結的 `?sos=<token>` 都接受；只接受 32 hex。 */
export function parseShareToken(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed && /^[0-9a-f]{32}$/i.test(trimmed) ? trimmed.toLowerCase() : null;
}
