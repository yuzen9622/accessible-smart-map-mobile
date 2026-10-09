import { Platform, StyleSheet, Text, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { MAX_FONT_SCALE, TYPE, useSemanticColors, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import {
  formatReportDate,
  hazardCanResubmit,
  hazardExpired,
  hazardReviewStatus,
  reportPresentation,
  reportReviewReason,
  type ReportPresentation,
} from '../../domain/review';
import type { ReviewPollNotice } from '../../domain/reviewPoller';
import { reviewList, type HazardReport } from '../../domain/types';
import { ActionButton, Bullets, Disclosure, KeyValue, SectionTitle, TONE_ICON, reportStyles, useToneColors } from './reportUi';

interface ReportReviewSectionProps {
  report: HazardReport | undefined;
  reportId: string;
  notice: ReviewPollNotice;
  now: number;
  merged?: boolean;
  onRefresh: () => void;
  onResubmit: (report: HazardReport) => void;
  /** 回報查無（寫入不確定且後來確認不存在）時重新填一筆 */
  onNewSubmission?: () => void;
}

const UNKNOWN_PRESENTATION: ReportPresentation = { label: 'reportStateReviewing', tone: 'reviewing' };

/**
 * 審核結果區塊（Web `HazardReportResultContent` + `HazardReviewDetails`）：狀態卡、AI 判讀說明、
 * 下一張照片建議、觀察內容、證據與限制（收合）、處理時間（收合）、刷新與重新回報。
 */
export default function ReportReviewSection({ report, reportId, notice, now, merged, onRefresh, onResubmit, onNewSubmission }: ReportReviewSectionProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const semantic = useSemanticColors();
  const presentation = report ? reportPresentation(report, now) : UNKNOWN_PRESENTATION;
  const tone = useToneColors(presentation.tone);
  const expired = report ? hazardExpired(report, now) : false;
  const reason = report && !expired ? reportReviewReason(report) : null;
  const statusText = t(report ? hazardReviewStatus(report, now) : 'hazardReviewUncertain');

  return (
    <View style={styles.root}>
      {/* 狀態改變時讀屏主動朗讀（Web `aria-live="polite"`） */}
      <View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={[t(presentation.label), statusText, reason].filter(Boolean).join('，')}
        style={[reportStyles.card, { backgroundColor: tone.bg }]}>
        <View style={styles.statusHeader}>
          <Icon name={TONE_ICON[presentation.tone]} size={20} color={tone.fg} />
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.heading} style={[styles.statusTitle, { color: tone.fg }]}>
            {t(presentation.label)}
          </Text>
        </View>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[reportStyles.body, { color: colors.text }]}>
          {statusText}
        </Text>
        {reason ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.reason, { color: colors.text, borderTopColor: semantic.separator }]}>
            {reason}
          </Text>
        ) : null}
      </View>

      {merged ? <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[reportStyles.body, { color: colors.text }]}>{t('hazardReviewMerged')}</Text> : null}
      {report && !expired ? <ReviewDetails report={report} /> : null}

      {notice !== 'idle' ? (
        <View accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: colors.backgroundElement }]}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[reportStyles.small, { color: colors.text }]}>
            {t(`hazardPoll_${notice}`)}
          </Text>
        </View>
      ) : null}

      {!expired ? <ActionButton label={t('hazardReviewRefresh')} icon="refresh" variant="plain" onPress={onRefresh} /> : null}
      {!report && notice === 'missing' && onNewSubmission ? (
        <ActionButton label={t('hazardReviewResubmit')} icon="camera" onPress={onNewSubmission} />
      ) : null}
      {report && hazardCanResubmit(report, now) ? <ActionButton label={t('hazardReviewResubmit')} icon="camera" onPress={() => onResubmit(report)} /> : null}

      <Disclosure title={t('hazardReportId')} icon="info">
        <Text selectable style={[reportStyles.small, styles.mono, { color: colors.textSecondary }]}>
          {reportId}
        </Text>
      </Disclosure>
    </View>
  );
}

function ReviewDetails({ report }: { report: HazardReport }) {
  const { t, i18n } = useAppTranslation();
  const colors = useThemeColors();
  const review = report.aiReview;
  const observations = reviewList(review, 'observations');
  const limitations = reviewList(review, 'limitations');
  const evidence = reviewList(review, 'requiredEvidence');
  const visible = reviewList(review, 'visibleHazards');
  const streetHint = review?.reasonCode === 'NON_STREET_IMAGE';
  const exif = report.exifValidation;
  const gps =
    exif?.gpsPresent === false
      ? 'reportGpsAbsent'
      : exif?.gpsMatchesClaimed === true
        ? 'reportGpsMatches'
        : exif?.gpsPresent === true
          ? 'reportGpsUnconfirmed'
          : 'reportUnknown';
  const fresh = exif?.timestampFresh;
  const times = [
    { key: 'reportSubmitted', value: report.createdAt },
    { key: 'reportQueued', value: review?.queuedAt },
    { key: 'reportReviewStarted', value: review?.startedAt },
    { key: 'reportReviewFinished', value: review?.completedAt },
  ].flatMap((item) => {
    const label = formatReportDate(item.value, i18n.language);
    return label ? [{ key: item.key, label }] : [];
  });

  return (
    <View style={styles.root}>
      {evidence.length > 0 || streetHint ? (
        <View style={[reportStyles.card, { backgroundColor: colors.backgroundElement }]}>
          <SectionTitle icon="camera">{t('reportNextPhoto')}</SectionTitle>
          {streetHint ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[reportStyles.body, { color: colors.text }]}>
              {t('reportStreetPhotoHint')}
            </Text>
          ) : null}
          {evidence.length > 0 ? <Bullets items={evidence.map((item) => t(`hazardEvidence_${item}`))} /> : null}
        </View>
      ) : null}

      {observations.length > 0 ? (
        <View style={styles.block}>
          <SectionTitle icon="search">{t('reportObservations')}</SectionTitle>
          <Bullets items={observations} />
        </View>
      ) : null}

      <Disclosure title={t('reportEvidenceDetails')} icon="info">
        {exif ? (
          <View style={styles.block}>
            <KeyValue label={t('reportPhotoGps')} value={t(gps)} />
            <KeyValue
              label={t('reportPhotoTime')}
              value={t(fresh === true ? 'reportTimeFresh' : fresh === false ? 'reportTimeUnconfirmed' : 'reportUnknown')}
            />
          </View>
        ) : null}
        {exif?.gpsPresent === false ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[reportStyles.small, { color: colors.textSecondary }]}>
            {t('reportGpsHint')}
          </Text>
        ) : null}
        {limitations.length > 0 ? (
          <View style={styles.block}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[reportStyles.body, styles.strong, { color: colors.text }]}>
              {t('reportLimitations')}
            </Text>
            <Bullets items={limitations} />
          </View>
        ) : null}
        {visible.length > 0 ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[reportStyles.body, { color: colors.text }]}>
            {`${t('reportVisibleHazards')}：${visible.map((value) => t(`reportVisible_${value}`, { defaultValue: value })).join('、')}`}
          </Text>
        ) : null}
        {!exif && limitations.length === 0 && visible.length === 0 ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[reportStyles.small, { color: colors.textSecondary }]}>
            {t('reportNoEvidence')}
          </Text>
        ) : null}
      </Disclosure>

      {times.length > 0 ? (
        <Disclosure title={t('reportTimeline')} icon="clock">
          {times.map((item) => (
            <KeyValue key={item.key} label={t(item.key)} value={item.label} />
          ))}
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[reportStyles.small, { color: colors.textSecondary }]}>
            {t('reportTaipeiTime')}
          </Text>
        </Disclosure>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  block: { gap: 8 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusTitle: { fontSize: TYPE.body, fontWeight: '700', flexShrink: 1 },
  reason: { fontSize: TYPE.body, lineHeight: 24, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 2 },
  notice: { borderRadius: 12, padding: 12 },
  strong: { fontWeight: '600' },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
});
