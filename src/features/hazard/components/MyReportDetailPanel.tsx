import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { MAX_FONT_SCALE, MIN_TOUCH, RADIUS, TYPE, useSemanticColors, useThemeColors } from '@/shared/theme';
import { ErrorState, Icon, type IconName } from '@/shared/ui';

import { hazardExpired } from '../domain/review';
import type { HazardReport } from '../domain/types';
import { useReportReview } from '../hooks/useReportReview';
import type { MyReportDetailModel } from '../hooks/useMyReportDetail';
import { resubmitHazardReport } from '../hooks/useMyReportDetail';
import ReportPhoto from './report/ReportPhoto';
import ReportReviewSection from './report/ReportReviewSection';
import { ActionButton, KeyValue, SectionTitle, reportStyles } from './report/reportUi';

type ReadyModel = Extract<MyReportDetailModel, { status: 'ready' }>;

/**
 * 設定 → 我的回報 → 單筆（Web `MyReportsPanel` 的詳情視圖）：先講結果（審核狀態與建議），
 * 再列使用者提交的內容、位置、社群回饋與期限。
 */
export default function MyReportDetailPanel({ model }: { model: MyReportDetailModel }) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  if (model.status === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }
  if (model.status !== 'ready') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        {model.status === 'network' ? (
          <ErrorState title={t('nativeNetworkError')} systemImage="wifi.slash" retry={{ label: t('retry'), onPress: model.retry }} />
        ) : (
          <ErrorState title={t('hazardVoteReportNotFound')} systemImage="mappin.slash" />
        )}
      </View>
    );
  }
  return <ReadyDetail key={model.report._id} model={model} />;
}

function ReadyDetail({ model }: { model: ReadyModel }) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const semantic = useSemanticColors();
  // 列表 store 的資料當初始值，輪詢結果同時寫回列表
  const review = useReportReview(model.report._id, model.report, model.onReportUpdate);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}>
        <View style={styles.eyebrowRow}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.eyebrow, { color: colors.textSecondary }]}>
            {t('reportDetailEyebrow')}
          </Text>
          {model.severityLabel ? (
            <View style={[styles.chip, { backgroundColor: semantic.surface }]}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.chipText, { color: colors.text }]}>
                {model.severityLabel}
              </Text>
            </View>
          ) : null}
        </View>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.heading} accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {model.typeLabel}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[reportStyles.small, { color: colors.textSecondary }]}>
          {model.submittedLabel}
        </Text>
      </View>

      <ReportReviewSection
        report={review.report}
        reportId={model.report._id}
        notice={review.notice}
        now={review.now}
        onRefresh={review.refresh}
        onResubmit={(report: HazardReport) => resubmitHazardReport(report)}
      />

      <View style={styles.section}>
        <SectionTitle>{t('reportYourSubmission')}</SectionTitle>
        {model.hasPhoto ? <ReportPhoto reportId={model.report._id} variant="detail" /> : null}
        <Text
          maxFontSizeMultiplier={MAX_FONT_SCALE.body}
          selectable
          style={[styles.description, { color: model.hasDescription ? colors.text : colors.textSecondary }]}>
          {model.description}
        </Text>
      </View>

      <View style={[styles.locationCard, { borderColor: semantic.separator }]}>
        <View style={styles.locationBody}>
          <View style={[styles.iconTile, { backgroundColor: semantic.surface }]}>
            <Icon name="mapPin" size={20} color={colors.text} />
          </View>
          <View style={styles.flex}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[reportStyles.body, styles.strong, { color: colors.text }]}>
              {t('myReportsLocation')}
            </Text>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} selectable style={[reportStyles.small, styles.tabular, { color: colors.textSecondary }]}>
              {model.coordinates}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('myReportsMap')}
          onPress={model.showOnMap}
          style={({ pressed }) => [styles.mapButton, { borderTopColor: semantic.separator, backgroundColor: semantic.surface }, pressed && styles.dim]}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[reportStyles.body, styles.strong, { color: semantic.accent }]}>
            {t('myReportsMap')}
          </Text>
          <Icon name="arrowUpRight" size={18} color={semantic.accent} />
        </Pressable>
      </View>

      <View style={styles.section}>
        <SectionTitle>{t('reportCommunity')}</SectionTitle>
        <View style={styles.stats}>
          <Stat icon="thumbsUp" value={model.confirmCount} label={t('reportConfirmCount')} />
          <Stat icon="thumbsDown" value={model.denyCount} label={t('reportDenyCount')} />
        </View>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[reportStyles.small, { color: colors.textSecondary }]}>
          {t('myReportsStatusHint')}
        </Text>
      </View>

      <View style={[styles.dates, { borderTopColor: semantic.separator }]}>
        {model.dates.map((item) => (
          <KeyValue key={item.key} label={item.label} value={item.value} />
        ))}
      </View>

      {hazardExpired(model.report, review.now) ? <ActionButton label={t('hazardReviewResubmit')} icon="camera" onPress={model.resubmit} /> : null}
    </ScrollView>
  );
}

function Stat({ icon, value, label }: { icon: IconName; value: number; label: string }) {
  const colors = useThemeColors();
  return (
    <View accessible accessibilityLabel={`${label}：${value}`} style={[styles.stat, { backgroundColor: colors.backgroundElement }]}>
      <Icon name={icon} size={16} color={colors.textSecondary} />
      <View style={styles.flex}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.statValue, { color: colors.text }]}>
          {value}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.statLabel, { color: colors.textSecondary }]}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.6 },
  strong: { fontWeight: '600' },
  tabular: { fontVariant: ['tabular-nums'], marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16, paddingBottom: 40, gap: 24 },
  header: { gap: 6 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  eyebrow: { fontSize: TYPE.caption, fontWeight: '600', letterSpacing: 0.4 },
  chip: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: TYPE.caption, fontWeight: '600' },
  title: { fontSize: TYPE.title, fontWeight: '700' },
  section: { gap: 10 },
  description: { fontSize: TYPE.body, lineHeight: 26 },
  locationCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.card, overflow: 'hidden' },
  locationBody: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' },
  iconTile: { borderRadius: RADIUS.small, padding: 9 },
  mapButton: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: RADIUS.small, padding: 12 },
  statValue: { fontSize: TYPE.headline, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: TYPE.caption },
  dates: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16, gap: 10 },
});
