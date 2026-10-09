import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { create } from 'zustand';

import { useAuthStore } from '@/features/auth';
import { useAppTranslation } from '@/shared/i18n';
import { logger } from '@/shared/logger';

import { getMyHazardReports } from '../api/hazardApi';
import { HAZARD_TYPE_LABEL_KEY, SEVERITY_LABEL_KEY } from '../domain/hazardErrors';
import { formatReportDate, reportPresentation, reportReviewReason, type ReportTone } from '../domain/review';
import { reportHasPhoto, type HazardReport } from '../domain/types';

/**
 * 我的回報（`GET /reports/mine`，新到舊、cursor 分頁），對齊 Web `MyReportsPanel`（commit 58f1840）。
 * 列表與詳情共用這份 store：詳情頁的審核輪詢回推最新狀態，回到列表時同步顯示。
 * 以帳號為鍵：換帳號或登出就丟掉上一個帳號的資料與進行中的請求。
 */
interface MyReportsState {
  ownerId: string | null;
  reports: HazardReport[];
  nextCursor: string | null;
  loading: boolean;
  refreshing: boolean;
  error: boolean;
  loaded: boolean;
}

const EMPTY: Omit<MyReportsState, 'ownerId'> = {
  reports: [],
  nextCursor: null,
  loading: false,
  refreshing: false,
  error: false,
  loaded: false,
};

const useMyReportsStore = create<MyReportsState>(() => ({ ownerId: null, ...EMPTY }));

let inflight: AbortController | null = null;

/** `silent`：回到列表時背景更新第一頁，不顯示轉圈（審核狀態可能在別頁變了）。 */
async function load(ownerId: string, mode: 'reset' | 'more' | 'refresh' | 'silent'): Promise<void> {
  const state = useMyReportsStore.getState();
  if (state.ownerId !== ownerId) {
    inflight?.abort();
    inflight = null;
    useMyReportsStore.setState({ ownerId, ...EMPTY });
  } else if (inflight) {
    return;
  }
  const cursor = mode === 'more' ? useMyReportsStore.getState().nextCursor : null;
  const controller = new AbortController();
  inflight = controller;
  if (mode === 'refresh') useMyReportsStore.setState({ refreshing: true, error: false });
  else if (mode !== 'silent') useMyReportsStore.setState({ loading: true, error: false });
  try {
    const page = await getMyHazardReports(cursor, controller.signal);
    if (controller.signal.aborted || useMyReportsStore.getState().ownerId !== ownerId) return;
    useMyReportsStore.setState((s) => {
      // 分頁之間可能因新回報插入而重複：以 _id 去重，保留先出現（較新）的那筆
      const merged = new Map((mode === 'more' ? [...s.reports, ...page.reports] : page.reports).map((r) => [r._id, r]));
      if (mode === 'silent' && s.loaded) {
        // 只更新第一頁的資料，保留已載入的後續頁與 cursor
        const fresh = new Map(page.reports.map((r) => [r._id, r]));
        const kept = s.reports.filter((r) => !fresh.has(r._id));
        return { reports: [...page.reports, ...kept] };
      }
      return { reports: [...merged.values()], nextCursor: page.nextCursor, loaded: true };
    });
  } catch (error) {
    if (controller.signal.aborted) return;
    logger.warn('[hazard] my reports failed', error);
    // 背景更新失敗就保留目前的列表，不蓋成錯誤畫面
    if (mode !== 'silent' && useMyReportsStore.getState().ownerId === ownerId) useMyReportsStore.setState({ error: true });
  } finally {
    if (inflight === controller) {
      inflight = null;
      useMyReportsStore.setState({ loading: false, refreshing: false });
    }
  }
}

/** 詳情頁輪詢到的新狀態寫回列表。 */
export function updateMyReport(next: HazardReport): void {
  useMyReportsStore.setState((s) => ({ reports: s.reports.map((r) => (r._id === next._id ? { ...r, ...next } : r)) }));
}

/** 送出新回報後讓列表下次進來時重抓。 */
export function invalidateMyReports(): void {
  inflight?.abort();
  inflight = null;
  useMyReportsStore.setState((s) => ({ ownerId: s.ownerId, ...EMPTY }));
}

export function useMyReport(id: string | undefined): HazardReport | null {
  const userId = useAuthStore((s) => s.user?._id ?? null);
  return useMyReportsStore((s) => (userId !== null && s.ownerId === userId ? (s.reports.find((r) => r._id === id) ?? null) : null));
}

export interface MyReportRow {
  id: string;
  typeLabel: string;
  severityLabel: string | null;
  statusLabel: string;
  tone: ReportTone;
  dateLabel: string;
  description: string;
  hasDescription: boolean;
  reason: string | null;
  hasPhoto: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}

export function newHazardReport(): void {
  router.navigate('/hazard-report');
}

export function useMyReports() {
  const { t, i18n } = useAppTranslation();
  const userId = useAuthStore((s) => s.user?._id ?? null);
  const state = useMyReportsStore();
  const [now, setNow] = useState(() => Date.now());

  // 每次回到列表（首次進入、從詳情返回、關掉通報 modal）都更新：首次或被標成過期（invalidateMyReports）時整頁重抓，
  // 否則背景更新第一頁——審核狀態可能在詳情或送出結果頁裡已經變了。useFocusEffect 需要穩定的 callback。
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      const current = useMyReportsStore.getState();
      void load(userId, current.ownerId === userId && current.loaded ? 'silent' : 'reset');
    }, [userId]),
  );

  // 過期是時間邊界：停在列表上也要更新狀態膠囊
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const mine = userId !== null && state.ownerId === userId;
  const reports = mine ? state.reports : [];
  const loading = !mine || state.loading || (!state.loaded && !state.error);

  const rows: MyReportRow[] = reports.map((report) => {
    const presentation = reportPresentation(report, now);
    const typeLabel = t(HAZARD_TYPE_LABEL_KEY[report.hazardType]);
    const severityLabel = report.severity ? t(SEVERITY_LABEL_KEY[report.severity]) : null;
    const statusLabel = t(presentation.label);
    const dateLabel = formatReportDate(report.createdAt, i18n.language, true) ?? t('myReportsUnknownDate');
    const description = report.description?.trim() || t('reportNoDescription');
    return {
      id: report._id,
      typeLabel,
      severityLabel,
      statusLabel,
      tone: presentation.tone,
      dateLabel,
      description,
      hasDescription: Boolean(report.description?.trim()),
      reason: reportReviewReason(report),
      hasPhoto: reportHasPhoto(report),
      accessibilityLabel: [typeLabel, statusLabel, severityLabel, dateLabel, description].filter(Boolean).join('，'),
      onPress: () => router.push({ pathname: '/settings/report/[id]', params: { id: report._id } }),
    };
  });

  return {
    loggedIn: userId !== null,
    login: () => router.navigate('/auth'),
    rows,
    loading: loading && rows.length === 0,
    loadingMore: mine && state.loading && rows.length > 0,
    refreshing: mine && state.refreshing,
    error: mine && state.error,
    empty: mine && state.loaded && !state.error && rows.length === 0,
    hasMore: mine && Boolean(state.nextCursor) && !state.error,
    loadMore: () => {
      if (userId) void load(userId, 'more');
    },
    refresh: () => {
      if (userId) void load(userId, 'refresh');
    },
    retry: () => {
      if (userId) void load(userId, state.nextCursor && rows.length > 0 ? 'more' : 'reset');
    },
    newReport: newHazardReport,
  };
}

export type MyReportsModel = ReturnType<typeof useMyReports>;
