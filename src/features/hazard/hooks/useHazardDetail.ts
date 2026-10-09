import { useEffect, useState } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import { useAuthStore } from '@/features/auth';
import { mapCamera } from '@/features/map';
import { ApiError } from '@/shared/api';
import { useAppTranslation } from '@/shared/i18n';
import { logger } from '@/shared/logger';

import { confirmHazardReport, getHazardReport } from '../api/hazardApi';
import { markVoted, updateReport, useHazardLayerStore } from '../controller/hazardLayerController';
import { canVote, HAZARD_TYPE_LABEL_KEY, SEVERITY_LABEL_KEY, voteErrorKey } from '../domain/hazardErrors';
import { hazardReviewStatus, reportPresentation } from '../domain/review';
import { reportLatLng, type HazardReport } from '../domain/types';

/** 通報詳情＋確認／否認投票，對齊 Web `HazardWrapper` popup（commit f82cda8）。登出也能投票（後端以 IP 雜湊識別）。 */
export function useHazardDetail(id: string | undefined) {
  const { t, i18n } = useAppTranslation();
  const userId = useAuthStore((s) => s.user?._id ?? null);
  const fromLayer = useHazardLayerStore((s) => s.reports.find((r) => r._id === id) ?? null);
  const voted = useHazardLayerStore((s) => (id ? s.votedIds.includes(id) : false));
  const [fetched, setFetched] = useState<HazardReport | null>(null);
  const [failure, setFailure] = useState<'notFound' | 'network' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [voting, setVoting] = useState(false);
  const report = fromLayer ?? fetched;

  // 圖層沒有（例如從推播或我的回報進來）才單獨抓
  useEffect(() => {
    if (!id || fromLayer) return;
    const controller = new AbortController();
    const run = async () => {
      try {
        const result = await getHazardReport(id, controller.signal);
        if (controller.signal.aborted) return;
        if (result) {
          setFetched(result);
          setFailure(null);
        } else {
          setFailure('notFound');
        }
      } catch (error) {
        logger.warn('[hazard] detail fetch failed', error);
        if (!controller.signal.aborted) setFailure('network');
      }
    };
    void run();
    return () => controller.abort();
  }, [id, fromLayer, attempt]);

  const retry = () => {
    setFailure(null);
    setAttempt((n) => n + 1);
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
    setVoting(true);
    try {
      const result = await confirmHazardReport(report._id, action);
      const next = { ...report, confirmCount: result.confirmCount, denyCount: result.denyCount };
      updateReport(next);
      setFetched((prev) => (prev ? next : prev));
      markVoted(report._id);
      const message = t(action === 'confirm' ? 'hazardVoteConfirmSuccess' : 'hazardVoteDenySuccess');
      AccessibilityInfo.announceForAccessibility(message);
    } catch (error) {
      const reason = error instanceof ApiError ? error.reason : undefined;
      if (reason === 'ALREADY_VOTED') markVoted(report._id);
      Alert.alert(t(voteErrorKey(reason)));
    } finally {
      setVoting(false);
    }
  };

  return {
    loading: !report && failure === null,
    failure: report ? null : failure,
    retry,
    report,
    typeLabel: report ? t(HAZARD_TYPE_LABEL_KEY[report.hazardType]) : '',
    severityLabel: report?.severity ? t(SEVERITY_LABEL_KEY[report.severity]) : null,
    statusText: report
      ? `${t(reportPresentation(report).label)}${report.confirmCount !== undefined ? ` · ${t('nativeHazardConfirmCount', { count: report.confirmCount })}` : ''}`
      : '',
    reviewText: report ? t(hazardReviewStatus(report)) : '',
    createdText: report?.createdAt ? new Date(report.createdAt).toLocaleString(i18n.language) : null,
    canVote: report ? canVote(report, userId) && !voted : false,
    voted,
    voting,
    confirm: () => void vote('confirm'),
    deny: () => void vote('deny'),
  };
}

export type HazardDetailModel = ReturnType<typeof useHazardDetail>;
