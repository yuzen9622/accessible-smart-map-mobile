import type { HazardReport, HazardType } from './types';

/**
 * 回報審核狀態，逐條移植自 Web `src/lib/hazard-review.ts` 與 `src/lib/report-presentation.ts`
 * （commit 58f1840 + 未提交的照片端點修改）。回傳值都是 i18n key。
 */

export const REVIEW_POLL_LIMIT_MS = 5 * 60_000;
export const REVIEW_REQUEST_TIMEOUT_MS = 15_000;
const LEGACY_STALL_MS = 10 * 60_000;

export type HazardReviewStatusKey =
  | 'hazardReviewExpired'
  | 'hazardReviewUnsupported'
  | 'hazardReviewVerified'
  | 'hazardReviewSupported'
  | 'hazardReviewNeedsEvidence'
  | 'hazardReviewDelayed'
  | 'hazardReviewQueued'
  | 'hazardReviewProcessing'
  | 'hazardReviewFailed'
  | 'hazardReviewCancelled'
  | 'hazardReviewLegacyStalled'
  | 'hazardReviewLegacy';

export function hazardExpired(report: HazardReport, now = Date.now()): boolean {
  return report.status === 'expired' || Boolean(report.expiredAt && Date.parse(report.expiredAt) <= now);
}

export function hazardReviewStatus(report: HazardReport, now = Date.now()): HazardReviewStatusKey {
  if (hazardExpired(report, now)) return 'hazardReviewExpired';
  if (report.status === 'rejected') return 'hazardReviewUnsupported';
  const review = report.aiReview;
  if (report.status === 'verified' && review?.decision !== 'supported') return 'hazardReviewVerified';
  if (review) {
    if (review.state === 'completed') {
      if (review.decision === 'supported') return 'hazardReviewSupported';
      return review.decision === 'unsupported' ? 'hazardReviewUnsupported' : 'hazardReviewNeedsEvidence';
    }
    if (review.state === 'queued' || review.state === 'processing') {
      if (review.delayed === true || (review.queuedAt && now - Date.parse(review.queuedAt) >= REVIEW_POLL_LIMIT_MS)) {
        return 'hazardReviewDelayed';
      }
      return review.state === 'queued' ? 'hazardReviewQueued' : 'hazardReviewProcessing';
    }
    return review.state === 'failed' ? 'hazardReviewFailed' : 'hazardReviewCancelled';
  }
  if (report.aiVerification?.verdict === 'suspicious') return 'hazardReviewNeedsEvidence';
  if (report.aiVerification?.verdict === 'skipped' && report.createdAt && now - Date.parse(report.createdAt) >= LEGACY_STALL_MS) {
    return 'hazardReviewLegacyStalled';
  }
  return 'hazardReviewLegacy';
}

/** 社群「確認仍有障礙」只在審核中或已核可時開放（Web `hazardCanConfirm`）。 */
export function hazardCanConfirm(report: HazardReport, now = Date.now()): boolean {
  if (hazardExpired(report, now)) return false;
  if (report.status === 'verified') return true;
  if (report.status !== 'pending') return false;
  if (!report.aiReview) return hazardReviewStatus(report, now) === 'hazardReviewLegacy';
  return report.aiReview.state === 'queued' || report.aiReview.state === 'processing';
}

const RESUBMITTABLE: readonly HazardReviewStatusKey[] = [
  'hazardReviewNeedsEvidence',
  'hazardReviewUnsupported',
  'hazardReviewFailed',
  'hazardReviewLegacyStalled',
];

export function hazardCanResubmit(report: HazardReport, now = Date.now()): boolean {
  return !hazardExpired(report, now) && RESUBMITTABLE.includes(hazardReviewStatus(report, now));
}

/** 重新回報只帶類型與座標；刻意不帶照片、描述、編號、投票與期限（需要新照片）。 */
export function hazardResubmitPreset(report: HazardReport): { hazardType: HazardType; lat: number; lng: number } {
  return {
    hazardType: report.hazardType,
    lat: report.reportedLocation.coordinates[1],
    lng: report.reportedLocation.coordinates[0],
  };
}

/** 審核仍在進行（需要輪詢）。 */
export function hazardReviewPending(report: HazardReport, now = Date.now()): boolean {
  return (
    !hazardExpired(report, now) &&
    report.status === 'pending' &&
    (report.aiReview?.state === 'queued' || report.aiReview?.state === 'processing')
  );
}

export type ReportTone = 'accepted' | 'reviewing' | 'attention' | 'rejected' | 'neutral';

export interface ReportPresentation {
  label: 'reportStateExpired' | 'reportStateRejected' | 'reportStateAccepted' | 'reportStateAttention' | 'reportStateStopped' | 'reportStateReviewing';
  tone: ReportTone;
}

/** 使用者看得懂的六種結果（列表的狀態膠囊、詳情的狀態卡）。 */
export function reportPresentation(report: HazardReport, now = Date.now()): ReportPresentation {
  const status = hazardReviewStatus(report, now);
  switch (status) {
    case 'hazardReviewExpired':
      return { label: 'reportStateExpired', tone: 'neutral' };
    case 'hazardReviewUnsupported':
      return { label: 'reportStateRejected', tone: 'rejected' };
    case 'hazardReviewSupported':
    case 'hazardReviewVerified':
      return { label: 'reportStateAccepted', tone: 'accepted' };
    case 'hazardReviewNeedsEvidence':
    case 'hazardReviewFailed':
    case 'hazardReviewLegacyStalled':
    case 'hazardReviewDelayed':
      return { label: 'reportStateAttention', tone: 'attention' };
    case 'hazardReviewCancelled':
      return { label: 'reportStateStopped', tone: 'neutral' };
    default:
      return { label: 'reportStateReviewing', tone: 'reviewing' };
  }
}

/** 審核說明：v2 的 `aiReview.reason` 優先，舊版退回 `aiVerification.reason`。 */
export function reportReviewReason(report: HazardReport): string | null {
  return report.aiReview?.reason || report.aiVerification?.reason || null;
}

/** 日期一律以台灣時間顯示（Web `reportDate`）；無效值回 null 由呼叫端顯示「—」。 */
export function formatReportDate(value: string | null | undefined, language: string, compact = false): string | null {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat(language, {
    timeZone: 'Asia/Taipei',
    month: 'numeric',
    day: 'numeric',
    ...(compact ? {} : { year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }),
  }).format(new Date(value));
}
