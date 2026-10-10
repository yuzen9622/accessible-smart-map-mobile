export type ContentTarget = { targetType: 'review' | 'hazard_report'; targetId: string };
export const REPORT_REASONS = ['inappropriate_image', 'harassment', 'personal_information', 'spam', 'misinformation', 'other'] as const;
export type ReportReason = typeof REPORT_REASONS[number];
export interface ReportReceipt {
  caseNumber: string;
  receivedAt: string;
  confirmationEmail: 'queued' | 'unavailable';
  duplicate: boolean;
}
export interface BlockedUser { blockId: string; label: string; createdAt: string }
export function validReport(reason: ReportReason | '', details: string): boolean {
  return REPORT_REASONS.some(value => value === reason) && details.length <= 1000 && (reason !== 'other' || details.trim().length > 0);
}
