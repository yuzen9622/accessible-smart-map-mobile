import { router } from 'expo-router';
import { create } from 'zustand';
import { useEffect } from 'react';

import { useAppTranslation } from '@/shared/i18n';

import { getMyHazardReports } from '../api/hazardApi';
import { HAZARD_TYPE_LABEL_KEY } from '../domain/hazardErrors';
import type { HazardReport } from '../domain/types';

/** 我的回報（`GET /reports/mine`，cursor 分頁）。Web 有 API 但沒有 UI；原生新增（ROADMAP 3.3）。 */
interface MyReportsState {
  reports: HazardReport[];
  nextCursor: string | null;
  loading: boolean;
  error: boolean;
}

const useMyReportsStore = create<MyReportsState>(() => ({ reports: [], nextCursor: null, loading: false, error: false }));

async function load(reset: boolean): Promise<void> {
  const state = useMyReportsStore.getState();
  if (state.loading) return;
  useMyReportsStore.setState({ loading: true, error: false });
  try {
    const page = await getMyHazardReports(reset ? null : state.nextCursor);
    useMyReportsStore.setState((s) => ({ reports: reset ? page.reports : [...s.reports, ...page.reports], nextCursor: page.nextCursor }));
  } catch {
    useMyReportsStore.setState({ error: true });
  } finally {
    useMyReportsStore.setState({ loading: false });
  }
}

const STATUS_KEY: Record<HazardReport['status'], string> = {
  pending: 'nativeHazardPending',
  verified: 'confirmed',
  rejected: 'nativeHazardRejected',
  expired: 'nativeHazardExpired',
};

export function useMyReports() {
  const { t, i18n } = useAppTranslation();
  const state = useMyReportsStore();
  useEffect(() => {
    void load(true);
  }, []);
  return {
    loading: state.loading,
    error: state.error,
    empty: !state.loading && !state.error && state.reports.length === 0,
    rows: state.reports.map((r) => ({
      id: r._id,
      title: t(HAZARD_TYPE_LABEL_KEY[r.hazardType]),
      subtitle: `${t(STATUS_KEY[r.status])}${r.createdAt ? ` · ${new Date(r.createdAt).toLocaleDateString(i18n.language)}` : ''}`,
      description: r.description ?? null,
      onPress: () => router.navigate({ pathname: '/hazard/[id]', params: { id: r._id } }),
    })),
    hasMore: Boolean(state.nextCursor),
    loadMore: () => void load(false),
    retry: () => void load(true),
  };
}

export type MyReportsModel = ReturnType<typeof useMyReports>;
