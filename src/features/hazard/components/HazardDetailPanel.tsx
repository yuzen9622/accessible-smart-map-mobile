import { ContentActions } from '@/features/content-safety';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTranslation } from '@/shared/i18n';
import { useFontScale } from '@/shared/preferences';
import { MAX_FONT_SCALE, RADIUS, SPACE, TYPE, useSemanticColors, useThemeColors } from '@/shared/theme';
import { Button, ErrorState, Icon } from '@/shared/ui';
import { Text } from '@/shared/ui/typography/Text';

import { reportPresentation } from '../domain/review';
import { reportHasPhoto } from '../domain/types';
import type { HazardDetailModel } from '../hooks/useHazardDetail';
import PublicReportPhoto from './report/PublicReportPhoto';
import { SectionTitle, StatusPill } from './report/reportUi';

/** 地圖回報詳情：現場照片與通行影響優先，單一捲動容器讓原生 sheet 正常交接拖曳。 */
export default function HazardDetailPanel({ model }: { model: HazardDetailModel }) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const semantic = useSemanticColors();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const appFontScale = useFontScale();
  const stackedVotes = fontScale * appFontScale >= 1.4;

  if (model.loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator accessibilityLabel={t('loading')} />
      </View>
    );
  }
  if (!model.report) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        {model.failure === 'network' ? (
          <ErrorState title={t('nativeNetworkError')} systemImage="wifi.slash" retry={{ label: t('retry'), onPress: model.retry }} />
        ) : (
          <ErrorState title={t('hazardVoteReportNotFound')} systemImage="mappin.slash" />
        )}
      </View>
    );
  }
  const report = model.report;
  const presentation = reportPresentation(report);
  const severityTone = report.severity === 'blocking' ? semantic.danger : report.severity === 'difficult' ? semantic.warn : semantic.neutral;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, SPACE.lg) + SPACE.lg }]}
      contentInsetAdjustmentBehavior="automatic">
        <View style={styles.header}>
          <View style={[styles.iconTile, { backgroundColor: severityTone.bg }]}>
            <Icon name={report.hazardType === 'construction' ? 'construction' : report.hazardType === 'data_error' ? 'mapPin' : 'alert'} size={24} color={severityTone.fg} />
          </View>
          <View style={styles.heading}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.heading} accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
              {model.typeLabel}
            </Text>
            {model.severityLabel ? (
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.severity, { color: severityTone.fg }]}>
                {t('hazardDetailImpact', { severity: model.severityLabel })}
              </Text>
            ) : null}
          </View>
          {report.reporterId !== model.userId ? <ContentActions targetType="hazard_report" targetId={report._id} canBlock={report.canBlockAuthor === true} /> : null}
        </View>

        <View style={styles.section}>
          <SectionTitle icon="camera">{t('hazardPhoto')}</SectionTitle>
          {report.publicPhotoUrl ? (
            <PublicReportPhoto url={report.publicPhotoUrl} onRefresh={model.retry} />
          ) : (
            <View style={[styles.noPhoto, { backgroundColor: semantic.surface }]}>
              <Icon name="image" size={22} color={colors.textSecondary} />
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.body, { color: colors.textSecondary }]}>{t(reportHasPhoto(report) ? 'hazardPublicPhotoUnavailable' : 'hazardDetailNoPhoto')}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SectionTitle>{t('hazardDetailDescription')}</SectionTitle>
          <Text selectable maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.description, { color: report.description ? colors.text : colors.textSecondary }]}>
            {report.description || t('hazardDetailNoDescription')}
          </Text>
          {model.createdText ? (
            <View style={styles.date}>
              <Icon name="clock" size={14} color={colors.textSecondary} />
              <Text selectable maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.caption, styles.flex, { color: colors.textSecondary }]}>
                {t('hazardDetailReportedAt', { date: model.createdText })}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.reviewCard, { backgroundColor: semantic.surface }]}>
          <StatusPill label={t(presentation.label)} tone={presentation.tone} />
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.body, { color: colors.textSecondary }]}>{model.reviewText}</Text>
          <View style={[styles.community, { borderTopColor: semantic.separator }]}>
            <Icon name="users" size={16} color={colors.textSecondary} />
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.caption, styles.flex, { color: colors.textSecondary }]}>
              {t('hazardDetailCommunity', { confirm: report.confirmCount ?? 0, deny: report.denyCount ?? 0 })}
            </Text>
          </View>
        </View>
      {model.voted || model.canVote ? (
        <View style={[styles.footer, { borderTopColor: semantic.separator }]}>
          {model.voted ? (
            <View style={styles.voted}>
              <Icon name="circleCheck" size={20} color={semantic.ok.fg} />
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.body, { color: colors.text }]}>{t('hazardVoted')}</Text>
            </View>
          ) : (
            <>
              <View style={styles.footerTitle}>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE.heading} accessibilityRole="header" style={[styles.footerHeading, { color: colors.text }]}>{t('hazardDetailOnSite')}</Text>
                {model.voting ? <ActivityIndicator accessibilityLabel={t('hazardDetailVoting')} /> : null}
              </View>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.caption, { color: colors.textSecondary }]}>{t('hazardDetailVoteHint')}</Text>
              <View style={[styles.votes, stackedVotes && styles.stackedVotes]}>
                <View style={!stackedVotes && styles.flex}><Button label={t('hazardDetailConfirm')} disabled={model.voting} onPress={model.confirm} /></View>
                <View style={!stackedVotes && styles.flex}><Button label={t('hazardDetailDeny')} variant="secondary" disabled={model.voting} onPress={model.deny} /></View>
              </View>
            </>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACE.xl },
  content: { padding: SPACE.xl, paddingTop: SPACE.lg, gap: SPACE.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  heading: { flex: 1, gap: SPACE.xs },
  iconTile: { width: 48, height: 48, borderRadius: RADIUS.card, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: TYPE.title, fontWeight: '700' },
  severity: { fontSize: TYPE.subhead, lineHeight: 20, fontWeight: '600' },
  section: { gap: SPACE.md },
  body: { fontSize: TYPE.callout, lineHeight: 22 },
  description: { fontSize: TYPE.body, lineHeight: 24 },
  caption: { fontSize: TYPE.subhead, lineHeight: 20 },
  date: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  noPhoto: { minHeight: 96, borderRadius: RADIUS.card, alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, padding: SPACE.lg },
  reviewCard: { borderRadius: RADIUS.card, padding: SPACE.lg, gap: SPACE.md },
  community: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SPACE.md },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SPACE.lg, gap: SPACE.sm },
  footerTitle: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  footerHeading: { fontSize: TYPE.body, fontWeight: '600', flex: 1 },
  votes: { flexDirection: 'row', gap: SPACE.md, paddingTop: SPACE.xs },
  stackedVotes: { flexDirection: 'column', alignItems: 'flex-start' },
  voted: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm },
});
