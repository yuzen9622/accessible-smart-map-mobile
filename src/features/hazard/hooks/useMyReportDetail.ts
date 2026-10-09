import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { mapCamera } from '@/features/map';
import { useAppTranslation } from '@/shared/i18n';
import { logger } from '@/shared/logger';

import { getHazardReport } from '../api/hazardApi';
import { HAZARD_TYPE_LABEL_KEY, SEVERITY_LABEL_KEY } from '../domain/hazardErrors';
import { formatReportDate, hazardResubmitPreset } from '../domain/review';
import { reportHasPhoto, reportLatLng, type HazardReport } from '../domain/types';
import { updateMyReport, useMyReport } from './useMyReports';

/** 以審核結果的預設值（類型＋座標）開新回報；照片與描述一律重填。 */
export function resubmitHazardReport(report: HazardReport): void {
  const preset = hazardResubmitPreset(report);
  router.navigate({
    pathname: '/hazard-report',
    params: { lat: String(preset.lat), lng: String(preset.lng), hazardType: preset.hazardType },
  });
}

/**
 * 「我的回報」單筆詳情（Web `MyReportsPanel` 的 selected 視圖）。資料優先取列表 store；
 * 從推播等處直接進來、列表還沒有這筆時，退回公開單筆查詢。
 */
export function useMyReportDetail(id: string | undefined) {
  const { t, i18n } = useAppTranslation();
  const listed = useMyReport(id);
  const [fetched, setFetched] = useState<HazardReport | null>(null);
  const [failure, setFailure] = useState<'notFound' | 'network' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const report = listed ?? fetched;

  useEffect(() => {
    if (!id || listed) return;
    const controller = new AbortController();
    const run = async () => {
      try {
        const result = await getHazardReport(id, controller.signal);
        if (controller.signal.aborted) return;
        setFetched(result);
        setFailure(result ? null : 'notFound');
      } catch (error) {
        logger.warn('[hazard] my report detail failed', error);
        if (!controller.signal.aborted) setFailure('network');
      }
    };
    void run();
    return () => controller.abort();
  }, [id, listed, attempt]);

  const date = (value: string | null | undefined) => formatReportDate(value, i18n.language) ?? t('reportNotProvided');

  if (!report) {
    return {
      status: failure ?? 'loading',
      retry: () => {
        setFailure(null);
        setAttempt((n) => n + 1);
      },
    } as const;
  }

  const { lat, lng } = reportLatLng(report);
  return {
    status: 'ready',
    report,
    onReportUpdate: (next: HazardReport) => {
      updateMyReport(next);
      setFetched((previous) => (previous ? { ...previous, ...next } : previous));
    },
    typeLabel: t(HAZARD_TYPE_LABEL_KEY[report.hazardType]),
    severityLabel: report.severity ? t(SEVERITY_LABEL_KEY[report.severity]) : null,
    submittedLabel: `${date(report.createdAt)} · ${t('reportSubmitted')}`,
    hasPhoto: reportHasPhoto(report),
    description: report.description?.trim() || t('reportNoDescription'),
    hasDescription: Boolean(report.description?.trim()),
    coordinates: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    showOnMap: () => {
      // 回到地圖（關掉設定 modal）並打開這筆回報的地圖詳情，相機由詳情頁移過去
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
