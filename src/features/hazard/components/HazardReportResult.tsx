import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { MAX_FONT_SCALE, TYPE, useThemeColors } from '@/shared/theme';

import type { HazardReportModel, HazardSubmitResult } from '../hooks/useHazardReport';
import { useReportReview } from '../hooks/useReportReview';
import ReportReviewSection from './report/ReportReviewSection';
import { ActionButton, reportStyles } from './report/reportUi';

/**
 * 送出後的結果頁（Web `HazardReportPanel` 的 result 分支）：留在同一個 modal 追蹤 AI 審核，
 * 不再只跳一次「已送出」就關掉。登入者可直接跳到「我的回報」看完整紀錄；匿名回報提示保留編號。
 */
export default function HazardReportResult({ model, result }: { model: HazardReportModel; result: HazardSubmitResult }) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const review = useReportReview(result.reportId, result.report ?? undefined);
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.heading} accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {t('reportSuccess')}
      </Text>
      <ReportReviewSection
        report={review.report}
        reportId={result.reportId}
        notice={review.notice}
        now={review.now}
        merged={result.merged}
        onRefresh={review.refresh}
        onResubmit={model.restart}
        onNewSubmission={() => model.restart()}
      />
      <View style={styles.actions}>
        {model.loggedIn ? (
          <ActionButton label={t('myReportsView')} icon="list" variant="secondary" onPress={() => model.openMyReports(result.reportId)} />
        ) : (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[reportStyles.small, { color: colors.textSecondary }]}>
            {t('myReportsAnonymous')}
          </Text>
        )}
        <ActionButton label={t('done')} onPress={model.done} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 20 },
  title: { fontSize: TYPE.headline, fontWeight: '700' },
  actions: { gap: 10 },
});
