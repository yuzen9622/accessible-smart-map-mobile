import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import { useContentSafetyStore } from '@/features/content-safety';
import { useAuthStore } from '@/features/auth';
import { mapCamera } from '@/features/map';
import { ApiError } from '@/shared/api';
import { useAppTranslation } from '@/shared/i18n';
import { appStateVisibility } from '@/shared/polling';

import { confirmHazardReport, fetchHazardReport } from '../api/hazardApi';
import { markVoted, updateReport, useHazardLayerStore } from '../controller/hazardLayerController';
import { canVote, HAZARD_TYPE_LABEL_KEY, SEVERITY_LABEL_KEY, voteErrorKey } from '../domain/hazardErrors';
import { formatReportDate, hazardExpired, hazardReviewStatus, reportPresentation } from '../domain/review';
import { createHazardReviewPoller, type HazardReviewPoller } from '../domain/reviewPoller';
import { reportLatLng, type HazardReport } from '../domain/types';

/** 公開詳情：快取只當初始值，審核中輪詢；前景／到期重讀 DTO，絕不以登入身分推導照片權限。 */
export function useHazardDetail(id: string | undefined) {
  const { t, i18n } = useAppTranslation();
  const userId = useAuthStore((s) => s.user?._id ?? null);
  const fromLayer = useHazardLayerStore((s) => s.reports.find((r) => r._id === id) ?? null);
  const voted = useHazardLayerStore((s) => (id ? s.votedIds.includes(id) : false));
  const revision = useContentSafetyStore(state => state.revision);
  const key = `${id}:${revision}`;
  const [fetched, setFetched] = useState<{ key: string; report: HazardReport } | null>(null);
  const [failureState, setFailure] = useState<{ key: string; reason: 'notFound' | 'network' } | null>(null);
  const failure = failureState?.key === key ? failureState.reason : null;
  const [clock, setClock] = useState(() => ({ key, time: Date.now() }));
  const now = clock.time;
  const [voting, setVoting] = useState(false);
  const poller = useRef<{ key: string; instance: HazardReviewPoller } | null>(null);
  // 最新單筆 DTO 優先；404 不能再以舊圖層快取復活已撤下的圖片。
  const report = failure === 'notFound' ? null : fetched?.key === key ? fetched.report : fromLayer;

  useEffect(() => {
    if (!id) return;
    const initial = useHazardLayerStore.getState().reports.find((item) => item._id === id);
    const instance = createHazardReviewPoller({
      initial,
      visibility: appStateVisibility,
      load: (signal) => fetchHazardReport(id, signal),
      onReport: (next) => {
        setClock({ key, time: Date.now() });
        setFetched({ key, report: next });
        setFailure(null);
        updateReport(next);
      },
      onNotice: (notice) => {
        if (notice === 'missing' || notice === 'network') {
          setFailure({ key, reason: notice === 'missing' ? 'notFound' : 'network' });
        }
      },
    });
    poller.current = { key, instance };
    // 即使已有已採用快取，也要在開啟詳情時確認最新公開資格。
    instance.refresh();
    const unsubscribe = appStateVisibility.subscribe((active) => {
      if (active) {
        setClock({ key, time: Date.now() });
        instance.refresh();
      }
    });
    return () => {
      unsubscribe();
      instance.dispose();
      if (poller.current?.instance === instance) poller.current = null;
    };
  }, [id, key]);

  const expiredAt = report?.expiredAt;
  useEffect(() => {
    const deadline = expiredAt ? Date.parse(expiredAt) : NaN;
    if (!Number.isFinite(deadline)) return;
    let timer: ReturnType<typeof setTimeout>;
    const expire = () => {
      const delay = deadline - Date.now();
      if (delay > 0) {
        timer = setTimeout(expire, Math.min(delay, 2_147_483_647));
        return;
      }
      // 先使 Image 卸載，再刷新；不能等慢網路或 expiry job 才移除已下載的圖片。
      setClock({ key, time: Date.now() });
      if (poller.current?.key === key) poller.current.instance.refresh();
    };
    timer = setTimeout(expire, Math.max(0, Math.min(deadline - Date.now(), 2_147_483_647)));
    return () => clearTimeout(timer);
  }, [expiredAt, key]);

  const retry = () => {
    setFailure(null);
    poller.current?.instance.refresh();
  };

  const center = report ? reportLatLng(report) : null;
  const centerLat = center?.lat;
  const centerLng = center?.lng;
  useEffect(() => {
    if (centerLat === undefined || centerLng === undefined) return;
    mapCamera.flyTo([centerLng, centerLat]);
  }, [centerLat, centerLng]);

  const vote = async (action: 'confirm' | 'deny') => {
    if (!report || voting) return;
    const voteRevision = useContentSafetyStore.getState().revision;
    setVoting(true);
    try {
      const result = await confirmHazardReport(report._id, action);
      if (voteRevision !== useContentSafetyStore.getState().revision || poller.current?.key !== key) return;
      const counts = { confirmCount: result.confirmCount, denyCount: result.denyCount };
      const latest = useHazardLayerStore.getState().reports.find((item) => item._id === report._id) ?? report;
      updateReport({ ...latest, ...counts });
      // 投票期間的 AI 刷新可能已換了 publicPhotoUrl，不以投票前的快照蓋回去。
      setFetched((previous) => ({ key, report: { ...(previous?.key === key ? previous.report : latest), ...counts } }));
      markVoted(report._id);
      AccessibilityInfo.announceForAccessibility(t(action === 'confirm' ? 'hazardVoteConfirmSuccess' : 'hazardVoteDenySuccess'));
    } catch (error) {
      if (voteRevision !== useContentSafetyStore.getState().revision || poller.current?.key !== key) return;
      const reason = error instanceof ApiError ? error.reason : undefined;
      if (reason === 'ALREADY_VOTED') markVoted(report._id);
      Alert.alert(t(voteErrorKey(reason)));
    } finally {
      setVoting(false);
    }
  };

  const currentTime = now;
  const displayedReport = report && (clock.key !== key || hazardExpired(report, currentTime)) ? { ...report, publicPhotoUrl: null } : report;
  return {
    userId,
    loading: Boolean(id) && !report && failure === null,
    failure: report ? null : failure,
    retry,
    report: displayedReport,
    typeLabel: report ? t(HAZARD_TYPE_LABEL_KEY[report.hazardType]) : '',
    severityLabel: report?.severity ? t(SEVERITY_LABEL_KEY[report.severity]) : null,
    statusText: report
      ? `${t(reportPresentation(report, currentTime).label)}${report.confirmCount !== undefined ? ` · ${t('nativeHazardConfirmCount', { count: report.confirmCount })}` : ''}`
      : '',
    reviewText: report ? t(hazardReviewStatus(report, currentTime)) : '',
    createdText: formatReportDate(report?.createdAt, i18n.language),
    canVote: report ? canVote(report, userId) && !voted : false,
    voted,
    voting,
    confirm: () => void vote('confirm'),
    deny: () => void vote('deny'),
  };
}

export type HazardDetailModel = ReturnType<typeof useHazardDetail>;
