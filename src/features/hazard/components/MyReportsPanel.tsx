import { Text } from '@/shared/ui/typography/Text';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { MAX_FONT_SCALE, MIN_TOUCH, RADIUS, TYPE, ACCENT_FILL, ON_ACCENT_FILL, useSemanticColors, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import type { MyReportRow } from '../hooks/useMyReports';
import type { MyReportsPanelProps } from './MyReportsPanel.types';
import ReportPhoto from './report/ReportPhoto';
import { ActionButton, StatusPill, reportStyles } from './report/reportUi';

/**
 * 設定 → 我的回報（Web `MyReportsPanel` 列表視圖）。卡片頂端是狀態膠囊與日期（使用者最在意「審核結果」），
 * 中間是照片縮圖＋類型／嚴重度／描述，底部是 AI 審核說明。RN 版型兩平台共用：卡片含照片與色彩狀態，
 * SwiftUI Form 的列無法承載。
 */
export default function MyReportsPanel({ model }: MyReportsPanelProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();

  if (!model.loggedIn) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[reportStyles.body, styles.centerText, { color: colors.text }]}>
          {t('myReportsLogin')}
        </Text>
        <ActionButton label={t('loginRegisterCta')} onPress={model.login} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={model.rows}
      keyExtractor={(row) => row.id}
      renderItem={({ item }) => <ReportCard row={item} />}
      ItemSeparatorComponent={Separator}
      refreshControl={<RefreshControl refreshing={model.refreshing} onRefresh={model.refresh} />}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (model.hasMore && !model.loadingMore) model.loadMore();
      }}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.heading} accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>
              {t('reportListHeading')}
            </Text>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[reportStyles.small, { color: colors.textSecondary }]}>
              {t('reportListSubtitle')}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('myReportsNew')}
            onPress={model.newReport}
            style={({ pressed }) => [styles.addButton, pressed && styles.dim]}>
            <Icon name="plus" size={22} color={ON_ACCENT_FILL} />
          </Pressable>
        </View>
      }
      ListEmptyComponent={
        model.loading ? (
          <View style={styles.state} accessibilityLabel={t('myReportsLoading')}>
            <ActivityIndicator />
          </View>
        ) : model.empty ? (
          <EmptyReports onNew={model.newReport} />
        ) : null
      }
      ListFooterComponent={
        <View style={styles.footer}>
          {model.loadingMore ? <ActivityIndicator /> : null}
          {model.error ? (
            <View accessibilityRole="alert" style={[reportStyles.card, { backgroundColor: colors.backgroundElement }]}>
              <Icon name="alert" color={colors.textSecondary} />
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[reportStyles.body, { color: colors.text }]}>
                {t('myReportsError')}
              </Text>
              <ActionButton label={t('myReportsRetry')} variant="secondary" onPress={model.retry} />
            </View>
          ) : null}
          {model.hasMore && !model.loadingMore ? <ActionButton label={t('myReportsMore')} variant="secondary" onPress={model.loadMore} /> : null}
          {model.rows.length > 0 && !model.hasMore ? (
            <View style={styles.footerNote}>
              <Icon name="clock" size={14} color={colors.textSecondary} />
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.caption, { color: colors.textSecondary }]}>
                {t('reportListFooter')}
              </Text>
            </View>
          ) : null}
        </View>
      }
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

function ReportCard({ row }: { row: MyReportRow }) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const semantic = useSemanticColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={row.accessibilityLabel}
      accessibilityHint={row.reason ? `${t('reportReviewSummary')}：${row.reason}` : undefined}
      onPress={row.onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.backgroundElement }, pressed && styles.dim]}>
      <View style={[styles.cardTop, { borderBottomColor: semantic.separator }]}>
        <StatusPill label={row.statusLabel} tone={row.tone} />
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.caption, { color: colors.textSecondary }]}>
          {row.dateLabel}
        </Text>
      </View>
      <View style={styles.cardBody}>
        {row.hasPhoto ? (
          <ReportPhoto reportId={row.id} variant="thumbnail" />
        ) : (
          <View style={[styles.photoPlaceholder, { backgroundColor: semantic.surface }]}>
            <Icon name="construction" size={26} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.flex}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.cardTitle, { color: colors.text }]}>
            {row.typeLabel}
          </Text>
          {row.severityLabel ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.caption, { color: colors.textSecondary }]}>
              {row.severityLabel}
            </Text>
          ) : null}
          <Text
            maxFontSizeMultiplier={MAX_FONT_SCALE.body}
            numberOfLines={2}
            style={[reportStyles.small, styles.description, { color: row.hasDescription ? colors.text : colors.textSecondary }]}>
            {row.description}
          </Text>
        </View>
        <Icon name="chevronRight" size={18} color={colors.textSecondary} />
      </View>
      {row.reason ? (
        <View style={[styles.reason, { backgroundColor: semantic.surface }]}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.caption, styles.reasonLabel, { color: colors.textSecondary }]}>
            {t('reportReviewSummary')}
          </Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} numberOfLines={2} style={[reportStyles.small, { color: colors.text }]}>
            {row.reason}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function EmptyReports({ onNew }: { onNew: () => void }) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const semantic = useSemanticColors();
  return (
    <View style={[styles.empty, { borderColor: semantic.separator }]}>
      <View style={[styles.emptyIcon, { backgroundColor: semantic.surface }]}>
        <Icon name="list" size={30} color={colors.textSecondary} />
      </View>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[reportStyles.body, styles.strong, styles.centerText, { color: colors.text }]}>
        {t('myReportsEmpty')}
      </Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[reportStyles.small, styles.centerText, { color: colors.textSecondary }]}>
        {t('reportEmptyHint')}
      </Text>
      <ActionButton label={t('myReportsNew')} icon="plus" onPress={onNew} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.6 },
  strong: { fontWeight: '600' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  centerText: { textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  heading: { fontSize: TYPE.headline, fontWeight: '700', marginBottom: 2 },
  addButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    backgroundColor: ACCENT_FILL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  state: { paddingVertical: 48, alignItems: 'center' },
  separator: { height: 12 },
  card: { borderRadius: RADIUS.card, overflow: 'hidden' },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cardBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  cardTitle: { fontSize: TYPE.body, fontWeight: '700' },
  description: { marginTop: 6 },
  photoPlaceholder: { width: 76, height: 76, borderRadius: RADIUS.small, alignItems: 'center', justifyContent: 'center' },
  reason: { marginHorizontal: 14, marginBottom: 14, borderRadius: RADIUS.small, paddingHorizontal: 12, paddingVertical: 10 },
  reasonLabel: { marginBottom: 2, fontWeight: '600' },
  caption: { fontSize: TYPE.caption },
  footer: { gap: 12, marginTop: 16 },
  footerNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: RADIUS.card,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  emptyIcon: { borderRadius: RADIUS.card, padding: 16 },
});
