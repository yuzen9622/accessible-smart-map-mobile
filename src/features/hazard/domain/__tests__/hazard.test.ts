import { canVote, submitErrorKey, voteErrorKey } from '../hazardErrors';
import {
  ALLOWED_REPORT_PHOTO_TYPES,
  MAX_REPORT_PHOTO_SIZE_BYTES,
  needsTranscode,
  photoFileName,
  validateHazardPhoto,
} from '../hazardPhoto';
import { isHazardReport, type HazardReport } from '../types';

// 照片驗證案例移植自 Web `HazardReportPanel.test.ts`（commit f82cda8）的 P2-5 區塊；
// 「report location」兩個案例驗的是 Web 元件 SSR 輸出，原生改由 `hazardDraft` 的地點快照處理（見 port-ledger）。
describe('validateHazardPhoto (P2-5)', () => {
  it('defines 5MB size limit and allowed MIME types', () => {
    expect(MAX_REPORT_PHOTO_SIZE_BYTES).toBe(5 * 1024 * 1024);
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']) {
      expect(ALLOWED_REPORT_PHOTO_TYPES).toContain(type);
    }
  });

  it('accepts valid JPEG, PNG, WebP, HEIC, and HEIF images within 5MB', () => {
    expect(validateHazardPhoto({ size: 1024 * 1024, type: 'image/jpeg' })).toEqual({ valid: true });
    expect(validateHazardPhoto({ size: 3 * 1024 * 1024, type: 'image/png' })).toEqual({ valid: true });
    expect(validateHazardPhoto({ size: 500 * 1024, type: 'image/webp' })).toEqual({ valid: true });
    expect(validateHazardPhoto({ size: 2 * 1024 * 1024, type: 'image/heic' })).toEqual({ valid: true });
    expect(validateHazardPhoto({ size: 2 * 1024 * 1024, type: 'image/heif' })).toEqual({ valid: true });
  });

  it('rejects unlisted types (BMP, PDF, text, executable, video)', () => {
    for (const type of ['image/bmp', 'application/pdf', 'text/plain', 'application/x-msdownload', 'video/mp4']) {
      expect(validateHazardPhoto({ size: 1024, type })).toEqual({ valid: false, error: 'INVALID_IMAGE_TYPE' });
    }
  });

  it('rejects images over 5MB, and checks the type before the size', () => {
    expect(validateHazardPhoto({ size: MAX_REPORT_PHOTO_SIZE_BYTES + 1, type: 'image/jpeg' })).toEqual({ valid: false, error: 'IMAGE_TOO_LARGE' });
    expect(validateHazardPhoto({ size: MAX_REPORT_PHOTO_SIZE_BYTES, type: 'image/jpeg' })).toEqual({ valid: true });
    expect(validateHazardPhoto({ size: MAX_REPORT_PHOTO_SIZE_BYTES + 1, type: 'image/gif' })).toEqual({ valid: false, error: 'INVALID_IMAGE_TYPE' });
  });
});

describe('needsTranscode (native: keep the original so EXIF survives)', () => {
  it('uploads an iPhone HEIC under 5MB as-is', () => {
    expect(needsTranscode({ size: 2_500_000, type: 'image/heic' })).toBe(false);
  });

  it('transcodes oversized, unknown-size or unsupported images', () => {
    expect(needsTranscode({ size: 6_000_000, type: 'image/jpeg' })).toBe(true);
    expect(needsTranscode({ size: null, type: 'image/jpeg' })).toBe(true);
    expect(needsTranscode({ size: 100, type: 'image/gif' })).toBe(true);
    expect(needsTranscode({ size: 100, type: null })).toBe(true);
  });

  it('names files by MIME', () => {
    expect(photoFileName('image/heic')).toBe('hazard.heic');
    expect(photoFileName('image/jpeg')).toBe('hazard.jpg');
  });
});

describe('error mapping', () => {
  it('maps submit reasons like the Web panel', () => {
    expect(submitErrorKey('EXIF_TOO_OLD', 400)).toBe('exifTooOld');
    expect(submitErrorKey('EXIF_GPS_MISMATCH', 400)).toBe('exifGpsMismatch');
    expect(submitErrorKey(undefined, 429)).toBe('reportRateLimited');
    expect(submitErrorKey(undefined, 500)).toBe('reportFailed');
  });

  it('maps vote reasons', () => {
    expect(voteErrorKey('SELF_CONFIRMATION')).toBe('hazardVoteSelfConfirmation');
    expect(voteErrorKey('whatever')).toBe('hazardVoteFailed');
  });

  const base = { _id: 'r', hazardType: 'obstacle', reportedLocation: { type: 'Point', coordinates: [121.5, 25.03] } } satisfies Omit<HazardReport, 'status'>;
  it('only reviewing or verified reports by someone else can be voted on', () => {
    const reviewing = { ...base, status: 'pending', aiReview: { state: 'processing' } } as const;
    expect(canVote({ ...reviewing, reporterId: 'a' }, 'b')).toBe(true);
    expect(canVote({ ...reviewing, reporterId: 'a' }, 'a')).toBe(false);
    expect(canVote({ ...base, status: 'verified' }, null)).toBe(true);
    expect(canVote({ ...base, status: 'rejected' }, null)).toBe(false);
    expect(canVote({ ...base, status: 'pending', aiReview: { state: 'completed', decision: 'needs_evidence' } }, null)).toBe(false);
  });
});

describe('isHazardReport', () => {
  const report = {
    _id: 'r1',
    hazardType: 'obstacle',
    severity: 'difficult',
    reportedLocation: { type: 'Point', coordinates: [121.5, 25.03] },
    status: 'pending',
    confirmCount: 1,
  };
  it('accepts a wire report and rejects broken ones', () => {
    expect(isHazardReport(report)).toBe(true);
    expect(isHazardReport({ ...report, hazardType: 'ufo' })).toBe(false);
    expect(isHazardReport({ ...report, reportedLocation: { coordinates: [1] } })).toBe(false);
  });

  // 實際 `/reports/mine` 回應：沒填描述是 `description: null`、`expectedUntil: null`，不能因此整筆被濾掉
  it('accepts null description and expectedUntil from the backend', () => {
    expect(isHazardReport({ ...report, description: null, expectedUntil: null, hasPhoto: true, aiReview: { state: 'queued' } })).toBe(true);
    expect(isHazardReport({ ...report, description: 42 })).toBe(false);
  });
});
