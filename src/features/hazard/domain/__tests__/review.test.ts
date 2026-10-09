import type { VisibilitySource } from '@/shared/polling';

import {
  formatReportDate,
  hazardCanConfirm,
  hazardCanResubmit,
  hazardResubmitPreset,
  hazardReviewStatus,
  reportPresentation,
  REVIEW_POLL_LIMIT_MS,
} from '../review';
import { createHazardReviewPoller, type ReviewPollNotice } from '../reviewPoller';
import { reportHasPhoto, type HazardReport } from '../types';

// 案例對照 Web `src/lib/__tests__/hazard-review.test.ts`（commit 58f1840）的狀態表與輪詢預算。
const NOW = Date.parse('2026-10-09T08:00:00Z');
const report = (overrides: Partial<HazardReport> = {}): HazardReport => ({
  _id: 'r1',
  hazardType: 'construction',
  reportedLocation: { type: 'Point', coordinates: [121.5, 25.03] },
  status: 'pending',
  createdAt: new Date(NOW - 60_000).toISOString(),
  ...overrides,
});

describe('hazardReviewStatus', () => {
  it.each<[string, Partial<HazardReport>, string]>([
    ['expired by status', { status: 'expired' }, 'hazardReviewExpired'],
    ['expired by time', { expiredAt: new Date(NOW - 1).toISOString() }, 'hazardReviewExpired'],
    ['rejected', { status: 'rejected' }, 'hazardReviewUnsupported'],
    ['verified without supported review', { status: 'verified' }, 'hazardReviewVerified'],
    ['supported', { aiReview: { state: 'completed', decision: 'supported' } }, 'hazardReviewSupported'],
    ['needs evidence', { aiReview: { state: 'completed', decision: 'needs_evidence' } }, 'hazardReviewNeedsEvidence'],
    ['unsupported', { aiReview: { state: 'completed', decision: 'unsupported' } }, 'hazardReviewUnsupported'],
    ['queued', { aiReview: { state: 'queued', queuedAt: new Date(NOW - 1000).toISOString() } }, 'hazardReviewQueued'],
    ['processing', { aiReview: { state: 'processing' } }, 'hazardReviewProcessing'],
    ['delayed flag', { aiReview: { state: 'processing', delayed: true } }, 'hazardReviewDelayed'],
    ['queued past the budget', { aiReview: { state: 'queued', queuedAt: new Date(NOW - REVIEW_POLL_LIMIT_MS).toISOString() } }, 'hazardReviewDelayed'],
    ['failed', { aiReview: { state: 'failed' } }, 'hazardReviewFailed'],
    ['cancelled', { aiReview: { state: 'cancelled' } }, 'hazardReviewCancelled'],
    ['legacy suspicious', { aiVerification: { verdict: 'suspicious', confidence: 0.4, reason: 'x' } }, 'hazardReviewNeedsEvidence'],
    [
      'legacy skipped and stalled',
      { aiVerification: { verdict: 'skipped', confidence: 0, reason: '' }, createdAt: new Date(NOW - 11 * 60_000).toISOString() },
      'hazardReviewLegacyStalled',
    ],
    ['legacy', {}, 'hazardReviewLegacy'],
  ])('%s', (_name, overrides, expected) => {
    expect(hazardReviewStatus(report(overrides), NOW)).toBe(expected);
  });
});

describe('presentation and actions', () => {
  it('maps review statuses to six user-facing states', () => {
    expect(reportPresentation(report({ status: 'expired' }), NOW)).toEqual({ label: 'reportStateExpired', tone: 'neutral' });
    expect(reportPresentation(report({ status: 'rejected' }), NOW).tone).toBe('rejected');
    expect(reportPresentation(report({ status: 'verified' }), NOW).tone).toBe('accepted');
    expect(reportPresentation(report({ aiReview: { state: 'failed' } }), NOW).tone).toBe('attention');
    expect(reportPresentation(report({ aiReview: { state: 'cancelled' } }), NOW).label).toBe('reportStateStopped');
    expect(reportPresentation(report({ aiReview: { state: 'processing' } }), NOW).tone).toBe('reviewing');
  });

  it('allows resubmission only when evidence is missing or the review failed', () => {
    expect(hazardCanResubmit(report({ aiReview: { state: 'completed', decision: 'needs_evidence' } }), NOW)).toBe(true);
    expect(hazardCanResubmit(report({ aiReview: { state: 'completed', decision: 'unsupported' } }), NOW)).toBe(true);
    expect(hazardCanResubmit(report({ aiReview: { state: 'completed', decision: 'supported' } }), NOW)).toBe(false);
    expect(hazardCanResubmit(report({ status: 'expired', aiReview: { state: 'failed' } }), NOW)).toBe(false);
  });

  it('allows community confirmation while reviewing or verified', () => {
    expect(hazardCanConfirm(report({ aiReview: { state: 'queued' } }), NOW)).toBe(true);
    expect(hazardCanConfirm(report({ status: 'verified' }), NOW)).toBe(true);
    expect(hazardCanConfirm(report({ aiReview: { state: 'completed', decision: 'needs_evidence' } }), NOW)).toBe(false);
  });

  it('resubmit preset keeps only type and coordinates', () => {
    expect(hazardResubmitPreset(report({ description: 'secret', hasPhoto: true }))).toEqual({ hazardType: 'construction', lat: 25.03, lng: 121.5 });
  });

  it('prefers hasPhoto over a legacy photoUrl', () => {
    expect(reportHasPhoto(report({ hasPhoto: true }))).toBe(true);
    expect(reportHasPhoto({ ...report({ hasPhoto: false }), photoUrl: 'https://storage/x.jpg' })).toBe(false);
    expect(reportHasPhoto({ ...report(), photoUrl: 'https://storage/x.jpg' })).toBe(true);
    expect(reportHasPhoto(report())).toBe(false);
  });

  it('formats dates in Taiwan time and rejects invalid values', () => {
    expect(formatReportDate('2026-10-08T17:30:00Z', 'en', true)).toBe('10/9');
    expect(formatReportDate('not a date', 'en')).toBeNull();
    expect(formatReportDate(undefined, 'en')).toBeNull();
  });
});

describe('createHazardReviewPoller', () => {
  let active = true;
  let listener: ((isActive: boolean) => void) | null = null;
  const visibility: VisibilitySource = {
    isActive: () => active,
    subscribe(onChange) {
      listener = onChange;
      return () => {
        listener = null;
      };
    },
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    active = true;
  });
  afterEach(() => jest.useRealTimers());

  const queued = report({ aiReview: { state: 'queued', queuedAt: new Date(NOW).toISOString() } });

  it('polls every 2 s while queued and stops once the review completes', async () => {
    const load = jest
      .fn<Promise<HazardReport>, [AbortSignal]>()
      .mockResolvedValueOnce(queued)
      .mockResolvedValueOnce(report({ aiReview: { state: 'completed', decision: 'supported' } }));
    const reports: HazardReport[] = [];
    const poller = createHazardReviewPoller({ initial: queued, load, onReport: (r) => reports.push(r), onNotice: () => undefined, visibility });
    await jest.advanceTimersByTimeAsync(2000);
    expect(load).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(2000);
    expect(load).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(load).toHaveBeenCalledTimes(2);
    expect(reports.at(-1)?.aiReview?.decision).toBe('supported');
    poller.dispose();
  });

  it('pauses in the background and stops on 404', async () => {
    const notices: ReviewPollNotice[] = [];
    const load = jest.fn<Promise<HazardReport>, [AbortSignal]>().mockRejectedValue(Object.assign(new Error('gone'), { code: 404 }));
    const poller = createHazardReviewPoller({ initial: queued, load, onReport: () => undefined, onNotice: (n) => notices.push(n), visibility });
    active = false;
    listener?.(false);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(load).not.toHaveBeenCalled();
    active = true;
    listener?.(true);
    await jest.advanceTimersByTimeAsync(2000);
    expect(load).toHaveBeenCalledTimes(1);
    expect(notices).toContain('missing');
    await jest.advanceTimersByTimeAsync(20_000);
    expect(load).toHaveBeenCalledTimes(1);
    poller.dispose();
  });

  it('reports delayed when the 5-minute budget runs out', async () => {
    const notices: ReviewPollNotice[] = [];
    const load = jest.fn<Promise<HazardReport>, [AbortSignal]>().mockResolvedValue(queued);
    const poller = createHazardReviewPoller({ initial: queued, load, onReport: () => undefined, onNotice: (n) => notices.push(n), visibility });
    await jest.advanceTimersByTimeAsync(REVIEW_POLL_LIMIT_MS + 10_000);
    expect(notices.at(-1)).toBe('delayed');
    const calls = load.mock.calls.length;
    await jest.advanceTimersByTimeAsync(60_000);
    expect(load).toHaveBeenCalledTimes(calls);
    poller.dispose();
  });
});
