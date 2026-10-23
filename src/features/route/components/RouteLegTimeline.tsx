import { Text } from '@/shared/ui/typography/Text';
import { StyleSheet, View } from 'react-native';

import { formatDistance } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';
import { useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import { LEG_ICON, LEG_LABEL_FILL } from '../domain/routeDisplay';
import type { LegTimelineSegment } from '../domain/routeCard';

export interface RouteLegTimelineProps {
  segments: LegTimelineSegment[];
}

/**
 * 路線卡的時間軸：依序列出每段步行／運具的時間（步行再加距離），中間用虛線連接，最後接目的地旗標
 * （使用者回饋 2026-10-23：規劃結果希望能看到每段花多久，不是只有終點總覽、擠成一堆圖示）。
 * 純展示用裝飾，實際資訊已經在卡片的 `accessibilityLabel` 念出，這裡整塊對 VoiceOver 隱藏。
 */
export default function RouteLegTimeline({ segments }: RouteLegTimelineProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();

  return (
    <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {segments.map((segment, index) => (
        <View key={`${segment.type}-${index}`} style={styles.step}>
          {index > 0 ? <View style={[styles.connector, { borderColor: colors.textSecondary }]} /> : null}
          <View style={[styles.iconBadge, { backgroundColor: LEG_LABEL_FILL[segment.type] }]}>
            <Icon name={LEG_ICON[segment.type]} size={16} color="#FFFFFF" />
          </View>
          {segment.label ? (
            <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
              {segment.label}
            </Text>
          ) : null}
          <Text style={[styles.meta, { color: colors.textSecondary }]}>{t('nativeRouteMinutes', { count: segment.durationMinutes })}</Text>
          {segment.distanceM != null ? (
            <Text style={[styles.meta, { color: colors.textSecondary }]}>{formatDistance(segment.distanceM)}</Text>
          ) : null}
        </View>
      ))}
      <View style={styles.step}>
        <View style={[styles.connector, { borderColor: colors.textSecondary }]} />
        <Icon name="flag" size={18} color={colors.textSecondary} />
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('destination')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { flex: 1, alignItems: 'center', gap: 2 },
  // 用上邊框畫虛線，貼齊圖示中心的高度；寬度交給 flex:1 的 step 平分。
  connector: { position: 'absolute', top: 15, left: '-50%', right: '50%', borderTopWidth: 1.5, borderStyle: 'dashed' },
  iconBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '600' },
  meta: { fontSize: 11 },
});
