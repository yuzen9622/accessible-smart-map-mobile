import type { VisibilitySource } from '@/shared/polling';

import { hazardReviewPending, hazardReviewStatus, REVIEW_POLL_LIMIT_MS, REVIEW_REQUEST_TIMEOUT_MS } from './review';
import type { HazardReport } from './types';

/**
 * 審核結果輪詢，移植自 Web `createHazardReviewPoller`（`src/lib/hazard-review.ts`）。語意逐條保留：
 * - 任何時刻最多一個請求（含背景中斷／回前景、手動刷新）；
 * - 前 30 秒每 2 秒、之後每 5 秒；總預算 5 分鐘（從排入佇列起算），不因背景、錯誤或手動刷新重置；
 * - 404／410 視為「回報不存在」，停止自動刷新；單次請求 15 秒逾時。
 * 差異：Web 用 `document.hidden`／`visibilitychange`，原生用注入的 `VisibilitySource`（`appStateVisibility`）。
 */

export type ReviewPollNotice = 'idle' | 'network' | 'delayed' | 'missing';

export interface HazardReviewPoller {
  refresh(): void;
  dispose(): void;
}

export function createHazardReviewPoller(options: {
  initial?: HazardReport;
  load: (signal: AbortSignal) => Promise<HazardReport>;
  onReport: (report: HazardReport) => void;
  onNotice: (notice: ReviewPollNotice) => void;
  visibility: VisibilitySource;
}): HazardReviewPoller {
  let report = options.initial;
  const start = Date.now();
  const queued = report?.aiReview?.queuedAt ? Date.parse(report.aiReview.queuedAt) : start;
  const deadline = Math.min(start + REVIEW_POLL_LIMIT_MS, Number.isFinite(queued) ? queued + REVIEW_POLL_LIMIT_MS : start + REVIEW_POLL_LIMIT_MS);
  let disposed = false;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let boundary: ReturnType<typeof setTimeout> | undefined;
  let requestTimer: ReturnType<typeof setTimeout> | undefined;
  let missing = false;
  let manualPending = false;

  const hidden = () => !options.visibility.isActive();
  const pending = () => !report || hazardReviewPending(report);
  const active = () => pending() && (!report || hazardReviewStatus(report) !== 'hazardReviewDelayed');
  const budget = () => Date.now() < deadline;
  const cancelRequest = () => {
    if (requestTimer) clearTimeout(requestTimer);
    requestTimer = undefined;
    // controller 保留到 load 結束，即使 load 不理會 abort 也不會同時發兩個請求
    controller?.abort();
  };
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  const armBoundary = () => {
    if (boundary) clearTimeout(boundary);
    const expires = report?.expiredAt ? Date.parse(report.expiredAt) : Infinity;
    const next = Math.min(deadline, expires);
    boundary = setTimeout(
      () => {
        clear();
        cancelRequest();
        if (disposed) return;
        if (report) options.onReport({ ...report });
        if (pending()) options.onNotice('delayed');
      },
      Math.max(0, next - Date.now()),
    );
  };
  const schedule = () => {
    clear();
    if (disposed || hidden() || missing || !active()) return;
    if (!budget()) {
      options.onNotice('delayed');
      return;
    }
    timer = setTimeout(() => void run(false), Date.now() - start < 30_000 ? 2000 : 5000);
  };
  const run = async (manual: boolean): Promise<void> => {
    if (disposed || hidden() || controller) return;
    if (!manual && (!budget() || missing || !active())) return;
    clear();
    const request = new AbortController();
    controller = request;
    requestTimer = setTimeout(() => {
      cancelRequest();
      if (!disposed && !hidden()) options.onNotice(budget() ? 'network' : 'delayed');
    }, REVIEW_REQUEST_TIMEOUT_MS);
    try {
      const next = await options.load(request.signal);
      if (disposed || request.signal.aborted) return;
      report = next;
      missing = false;
      options.onReport(next);
      options.onNotice(hazardReviewStatus(next) === 'hazardReviewDelayed' ? 'delayed' : 'idle');
      if (active() && budget()) armBoundary();
      else if (boundary) clearTimeout(boundary);
    } catch (error) {
      if (disposed || request.signal.aborted) return;
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
      missing = code === 404 || code === 410;
      options.onNotice(missing ? 'missing' : 'network');
      if (missing && boundary) clearTimeout(boundary);
    } finally {
      if (requestTimer) clearTimeout(requestTimer);
      requestTimer = undefined;
      controller = undefined;
      if (!disposed && manualPending && !hidden()) {
        manualPending = false;
        void run(true);
      } else {
        schedule();
      }
    }
  };
  const unsubscribe = options.visibility.subscribe((isActive) => {
    clear();
    if (!isActive) cancelRequest();
    else schedule();
  });
  if (active() && budget()) {
    armBoundary();
    schedule();
  } else if (pending()) {
    options.onNotice('delayed');
  }
  return {
    refresh() {
      if (controller) {
        manualPending = true;
        return;
      }
      void run(true);
    },
    dispose() {
      disposed = true;
      clear();
      if (boundary) clearTimeout(boundary);
      cancelRequest();
      unsubscribe();
    },
  };
}
