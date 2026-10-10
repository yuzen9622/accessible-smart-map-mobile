import { useEffect, useRef, useState } from 'react';

import { appStateVisibility } from '@/shared/polling';

import { fetchHazardReport } from '../api/hazardApi';
import { createHazardReviewPoller, type HazardReviewPoller, type ReviewPollNotice } from '../domain/reviewPoller';
import type { HazardReport } from '../domain/types';

/**
 * 單筆回報的審核狀態（Web `HazardReportResultSession` 的輪詢部分）：審核中自動刷新、App 進背景暫停、
 * 提供手動刷新。換 `reportId` 時由呼叫端以 `key` 重建，避免沿用上一筆的狀態。
 */
export function useReportReview(reportId: string, initial: HazardReport | undefined, onReport?: (report: HazardReport) => void, loadReport?: (signal: AbortSignal) => Promise<HazardReport>) {
  const [state, setState] = useState({ source: initial, report: initial });
  const report = state.source === initial ? state.report : initial;
  if (state.source !== initial) setState({ source: initial, report: initial });
  const [notice, setNotice] = useState<ReviewPollNotice>('idle');
  const poller = useRef<HazardReviewPoller | null>(null);
  // 通知重新取得私人詳情時，既有審核卡片也要採用新快照。
  const snapshot = useRef(initial);
  const callback = useRef(onReport);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    snapshot.current = initial;
  }, [initial]);

  useEffect(() => {
    callback.current = onReport;
  }, [onReport]);

  useEffect(() => {
    const instance = createHazardReviewPoller({
      initial: snapshot.current,
      visibility: appStateVisibility,
      load: (signal) => loadReport ? loadReport(signal) : fetchHazardReport(reportId, signal),
      onReport: (next) => {
        // 公開 GET 不帶 reporterId／可能缺欄位：合併到既有資料上，不要蓋掉本人才看得到的欄位
        setState((previous) => ({ ...previous, report: previous.report ? { ...previous.report, ...next } : next }));
        callback.current?.(next);
      },
      onNotice: setNotice,
    });
    poller.current = instance;
    return () => {
      instance.dispose();
      poller.current = null;
    };
  }, [reportId, loadReport]);

  // 過期與「舊版審核卡住」是時間邊界，終態回報也要到點更新畫面（不多打 API）
  const expiredAt = report?.expiredAt;
  const createdAt = report?.createdAt;
  const legacy = !report?.aiReview;
  useEffect(() => {
    const boundaries = [
      expiredAt ? Date.parse(expiredAt) : Infinity,
      legacy && createdAt ? Date.parse(createdAt) + 10 * 60_000 : Infinity,
    ].filter((time) => time > now);
    const next = Math.min(...boundaries);
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, Math.min(30_000, next - Date.now())));
    return () => clearTimeout(timer);
  }, [now, expiredAt, createdAt, legacy]);

  return { report, notice, now, refresh: () => poller.current?.refresh() };
}

export type ReportReviewModel = ReturnType<typeof useReportReview>;
