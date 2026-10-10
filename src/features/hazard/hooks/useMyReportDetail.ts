import { router, useNavigation, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { selectIsLoggedIn, useAuthStore } from '@/features/auth';
import { ApiError } from '@/shared/api';
import { mapCamera } from '@/features/map';
import { useAppTranslation } from '@/shared/i18n';
import { logger } from '@/shared/logger';

import { HAZARD_TYPE_LABEL_KEY, SEVERITY_LABEL_KEY } from '../domain/hazardErrors';
import { formatReportDate, hazardResubmitPreset } from '../domain/review';
import { reportHasPhoto, reportLatLng, type HazardReport } from '../domain/types';
import { findMyReport, updateMyReport, useMyReportsRevision } from './useMyReports';

/** 以審核結果的預設值（類型＋座標）開新回報；照片與描述一律重填。 */
export function resubmitHazardReport(report: HazardReport): void {
  const preset = hazardResubmitPreset(report);
  router.navigate({
    pathname: '/hazard-report',
    params: { lat: String(preset.lat), lng: String(preset.lng), hazardType: preset.hazardType },
  });
}

/** 私人詳情只接受目前 session 的 /mine 資料，每次 focus／通知都重新取得。 */
export function useMyReportDetail(id: string | undefined) {
  const { t, i18n } = useAppTranslation();
  const navigation = useNavigation();
  const session = useAuthStore((s) => s.session);
  const loggedIn = useAuthStore(selectIsLoggedIn);
  const revision = useMyReportsRevision((s) => s.revision);
  const [result, setResult] = useState<{ id: string; session: object; report: HazardReport | null; failure: 'notFound' | 'network' | null; revision: number; attempt: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const report = loggedIn && result?.session === session && result?.id === id ? result.report : null;
  const failure = result?.session === session && result?.id === id ? result.failure : null;
  const loadReport = useCallback(async (signal: AbortSignal) => {
    if (!id || !session || !loggedIn) throw new ApiError('Sign in required', 401);
    const next = await findMyReport(id, session, signal);
    if (!next) throw new ApiError('Report not available for this account', 404);
    return next;
  }, [id, session, loggedIn]);

  useFocusEffect(useCallback(() => {
    // 將刷新版本保留在結果中，讓通知／重試成為 callback 真正使用的依賴。
    setResult(null);
    if (!id || !session || !loggedIn) return;
    const controller = new AbortController();
    void loadReport(controller.signal).then((next) => {
      if (!controller.signal.aborted && useAuthStore.getState().session === session) {
        setResult({ id, session, report: next, failure: null, revision, attempt });
        updateMyReport(next, session);
      }
    }).catch((error: unknown) => {
      if (controller.signal.aborted || useAuthStore.getState().session !== session) return;
      logger.warn('[hazard] my report detail failed');
      setResult({ id, session, report: null, failure: error instanceof ApiError && error.code === 404 ? 'notFound' : 'network', revision, attempt });
    });
    return () => controller.abort();
  }, [id, session, loggedIn, loadReport, attempt, revision]));

  const date = (value: string | null | undefined) => formatReportDate(value, i18n.language) ?? t('reportNotProvided');

  if (!report) {
    return {
      status: !loggedIn ? 'signedOut' : !id ? 'notFound' : failure ?? 'loading',
      login: () => router.navigate('/auth'),
      retry: () => {
        setResult(null);
        setAttempt((n) => n + 1);
      },
    } as const;
  }

  const { lat, lng } = reportLatLng(report);
  return {
    status: 'ready',
    report,
    loadReport,
    onReportUpdate: (next: HazardReport) => {
      if (!session || useAuthStore.getState().session !== session) return;
      updateMyReport(next, session);
      setResult((previous) => previous?.session === session && previous.id === id ? { ...previous, report: next } : previous);
    },
    typeLabel: t(HAZARD_TYPE_LABEL_KEY[report.hazardType]),
    severityLabel: report.severity ? t(SEVERITY_LABEL_KEY[report.severity]) : null,
    submittedLabel: `${date(report.createdAt)} · ${t('reportSubmitted')}`,
    hasPhoto: reportHasPhoto(report),
    description: report.description?.trim() || t('reportNoDescription'),
    hasDescription: Boolean(report.description?.trim()),
    coordinates: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    showOnMap: () => {
      // 先關掉整個設定 modal（parent＝root stack），再打開這筆回報的地圖詳情；直接 navigate 只會把設定 stack 退回首頁
      navigation.getParent()?.goBack();
      mapCamera.flyTo([lng, lat], 17);
      router.navigate({ pathname: '/hazard/[id]', params: { id: report._id } });
    },
    confirmCount: report.confirmCount ?? 0,
    denyCount: report.denyCount ?? 0,
    dates: [
      { key: 'updated', label: t('reportUpdated'), value: date(report.updatedAt) },
      { key: 'expires', label: t('reportExpires'), value: date(report.expiredAt) },
      { key: 'expected', label: t('reportExpectedUntil'), value: date(report.expectedUntil) },
    ],
    resubmit: () => resubmitHazardReport(report),
  } as const;
}

export type MyReportDetailModel = ReturnType<typeof useMyReportDetail>;
