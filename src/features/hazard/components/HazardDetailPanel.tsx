import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { useFontScale } from '@/shared/preferences';
import { scaledSize, useThemeColors } from '@/shared/theme';
import { ErrorState, Icon, type IconName } from '@/shared/ui';

import type { HazardDetailModel } from '../hooks/useHazardDetail';
import { HAZARD_COLORS } from './HazardLayer';

function VoteButton({ label, icon, onPress, disabled }: { label: string; icon: IconName; onPress: () => void; disabled: boolean }) {
  const colors = useThemeColors();
  const scale = useFontScale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.vote, { backgroundColor: colors.backgroundElement }, (pressed || disabled) && styles.dim]}>
      <Icon name={icon} color={colors.text} />
      <Text style={{ color: colors.text, fontSize: scaledSize(15, scale), fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

/** `(sheet)/hazard/[id]`：通報詳情與確認／否認（RN 版型，與地點／設施詳情面板一致）。 */
export default function HazardDetailPanel({ model }: { model: HazardDetailModel }) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const scale = useFontScale();

  if (model.loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!model.report) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        {model.failure === 'network' ? (
          <ErrorState
            title={t('nativeNetworkError')}
            systemImage="wifi.slash"
            retry={{ label: t('retry'), onPress: model.retry }}
          />
        ) : (
          <ErrorState title={t('hazardVoteReportNotFound')} systemImage="mappin.slash" />
        )}
      </View>
    );
  }
  const report = model.report;
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}>
        <Icon name="alert" size={22} color={HAZARD_COLORS[report.hazardType]} />
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text, fontSize: scaledSize(20, scale) }]}>
          {model.typeLabel}
        </Text>
      </View>
      {model.severityLabel ? <Text style={{ color: colors.text, fontSize: scaledSize(16, scale) }}>{model.severityLabel}</Text> : null}
      <Text style={{ color: colors.textSecondary, fontSize: scaledSize(14, scale) }}>{model.statusText}</Text>
      {/* 照片只開放回報者本人（後端 `/reports/:id/photo` 授權）：公開詳情不顯示，本人到「我的回報」查看 */}
      <Text style={{ color: colors.textSecondary, fontSize: scaledSize(14, scale) }}>{model.reviewText}</Text>
      {report.description ? <Text style={{ color: colors.text, fontSize: scaledSize(16, scale) }}>{report.description}</Text> : null}
      {model.createdText ? <Text style={{ color: colors.textSecondary, fontSize: scaledSize(13, scale) }}>{model.createdText}</Text> : null}
      {model.voted ? (
        <Text style={{ color: colors.textSecondary, fontSize: scaledSize(15, scale) }}>{t('hazardVoted')}</Text>
      ) : model.canVote ? (
        <View style={styles.votes}>
          <VoteButton label={t('confirmHazard')} icon="thumbsUp" disabled={model.voting} onPress={model.confirm} />
          <VoteButton label={t('denyHazard')} icon="thumbsDown" disabled={model.voting} onPress={model.deny} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16, paddingTop: 20, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontWeight: '700' },
  votes: { flexDirection: 'row', gap: 10, marginTop: 6 },
  vote: { flex: 1, minHeight: 48, borderRadius: 12, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.5 },
});
