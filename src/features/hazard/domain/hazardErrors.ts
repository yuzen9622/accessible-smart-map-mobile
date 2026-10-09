import { hazardCanConfirm } from './review';
import type { HazardReport } from './types';

/**
 * 後端錯誤 reason → i18n key，對齊 Web `HazardReportPanel.handleSubmit` 與 `HazardWrapper` 投票（commit f82cda8）。
 */
export function submitErrorKey(reason: string | undefined, code: number | undefined): string {
  switch (reason) {
    case 'PHOTO_REQUIRED':
      return 'photoRequired';
    case 'INVALID_PHOTO_TYPE':
      return 'invalidImageType';
    case 'PHOTO_TOO_LARGE':
    case 'IMAGE_TOO_LARGE':
      return 'imageTooLarge';
    case 'IMAGE_INVALID':
      return 'hazardImageInvalid';
    case 'IMAGE_UNSUPPORTED':
      return 'hazardImageUnsupported';
    case 'REPORT_COMMIT_UNCERTAIN':
      return 'hazardReviewUncertain';
    case 'EXIF_TOO_OLD':
      return 'exifTooOld';
    case 'EXIF_GPS_MISMATCH':
      return 'exifGpsMismatch';
    case 'RATE_LIMITED':
      return 'reportRateLimited';
    default:
      return code === 429 ? 'reportRateLimited' : 'reportFailed';
  }
}

export function voteErrorKey(reason: string | undefined): string {
  switch (reason) {
    case 'SELF_CONFIRMATION':
      return 'hazardVoteSelfConfirmation';
    case 'ALREADY_VOTED':
      return 'hazardVoteAlreadyVoted';
    case 'REPORT_NOT_FOUND':
      return 'hazardVoteReportNotFound';
    case 'REPORT_EXPIRED':
      return 'hazardVoteReportExpired';
    default:
      return 'hazardVoteFailed';
  }
}

export const HAZARD_TYPE_LABEL_KEY = {
  obstacle: 'obstacle',
  construction: 'construction',
  data_error: 'dataError',
} as const;

export const SEVERITY_LABEL_KEY = {
  minor: 'severityMinor',
  difficult: 'severityDifficult',
  blocking: 'severityBlocking',
} as const;

/** 審核中或已核可、且不是自己回報的才能投票（Web `HazardWrapper`／`hazardCanConfirm`）。 */
export function canVote(report: HazardReport, userId: string | null): boolean {
  return hazardCanConfirm(report) && (!userId || report.reporterId !== userId);
}
