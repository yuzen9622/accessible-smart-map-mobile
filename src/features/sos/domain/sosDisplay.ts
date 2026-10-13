import type { EmergencyContact, HandlingStatus, PublicHandlingStatus, SosSnapshot, SosTimelineType, SosType } from './types';

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

/** 依後端提供的 lastSeenAt 與活動視窗，由前端計算目前查看裝置數。 */
export function countActiveSosViewers(snapshot: SosSnapshot | null, now = Date.now()): number {
  if (!snapshot?.viewers || typeof snapshot.viewerActiveWindowSeconds !== 'number' || snapshot.viewerActiveWindowSeconds < 0) return 0;
  const activeSince = now - snapshot.viewerActiveWindowSeconds * 1000;
  return snapshot.viewers.filter(({ lastSeenAt }) => new Date(lastSeenAt).getTime() >= activeSince).length;
}

/**
 * 分享給其他人的追蹤連結：`/{lng}/sos/#token=<shareToken>`。fragment 不會送到伺服器或 Referer；
 * App 以 Universal Link／App Link 認領這條路徑，沒裝 App 才由 Web 落地頁開啟地圖追蹤。
 */
export function buildSosShareUrl(shareBaseUrl: string, language: string, shareToken: string): string {
  const base = shareBaseUrl.replace(/\/+$/, '');
  return `${base}/${language}/sos/#token=${encodeURIComponent(shareToken)}`;
}

/** 家人端追蹤的處理進度步驟（不含 resolved：解除時整個畫面換成已解除狀態）。 */
export const TRACKER_PROGRESS_STEPS: readonly HandlingStatus[] = ['notified', 'acknowledged', 'claimed', 'en_route', 'arrived'];

/** 目前走到第幾步；`pending`／缺值 → -1（還沒通知到任何家人）。 */
export function trackerProgressIndex(status: PublicHandlingStatus | undefined): number {
  if (!status || status === 'pending') return -1;
  if (status === 'resolved') return TRACKER_PROGRESS_STEPS.length - 1;
  return TRACKER_PROGRESS_STEPS.indexOf(status);
}

/** 求助者位置超過這麼久沒更新就提醒「可能不是最新」（App 每 12 秒上傳一次，5 分鐘沒動靜代表斷線或關機）。 */
export const TRACKER_STALE_MS = 5 * 60 * 1000;

export type LocationFreshness = { kind: 'justNow' } | { kind: 'minutes'; minutes: number; stale: boolean };

export function locationFreshness(updatedAt: string, now: number): LocationFreshness {
  const ageMs = Math.max(0, now - new Date(updatedAt).getTime());
  if (ageMs < 60_000) return { kind: 'justNow' };
  return { kind: 'minutes', minutes: Math.floor(ageMs / 60_000), stale: ageMs >= TRACKER_STALE_MS };
}

/**
 * 回 LINE 官方帳號並預填「我處理」：送出後由 LINE bot 走既有的承接流程（多件事件時會讓使用者選）。
 * 沒設定 bot basic ID 就不顯示這個入口。
 */
export function buildLineClaimUrl(basicId: string, text: string): string {
  return `https://line.me/R/oaMessage/${basicId}/?${encodeURIComponent(text)}`;
}

/** 深層連結 `accessiblesmartmap://sos-track/<token>` 或 Web 分享連結中的 token；只接受 32 hex。 */
export function parseShareToken(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed && /^[0-9a-f]{32}$/i.test(trimmed) ? trimmed.toLowerCase() : null;
}

/**
 * 從公開追蹤 URL 讀取 share token。新連結只放在 fragment，避免送進伺服器與 Referer；
 * query 僅保留給已經發出的舊連結。兩者同時存在時以 fragment 為準。
 */
export function readSosTrackingToken(url: URL): string | null {
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
  return parseShareToken(fragment.get('token') ?? url.searchParams.get('token'));
}
