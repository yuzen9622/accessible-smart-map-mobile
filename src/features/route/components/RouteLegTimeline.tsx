import { Text } from '@/shared/ui/typography/Text';
import { StyleSheet, View } from 'react-native';

import { formatDistance } from '@/shared/geo';
import { useAppTranslation } from '@/shared/i18n';
import { ICON_SIZE, SHAPE, TYPE, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import { LEG_ICON, legBadgeColors } from '../domain/routeDisplay';
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
  const badges = segments.map((segment) => legBadgeColors(segment.type, segment.lineKey));

  return (
    <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {segments.map((segment, index) => (
        <View key={`${segment.type}-${index}`} style={styles.step}>
          {index > 0 ? <View style={[styles.connector, styles.connectorToBadge, { borderColor: colors.textSecondary }]} /> : null}
          <View style={[styles.iconBadge, { backgroundColor: badges[index].fill }]}>
            <Icon name={LEG_ICON[segment.type]} size={ICON_SIZE.caption} color={badges[index].fg} />
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
        <View style={[styles.connector, styles.connectorToFlag, { borderColor: colors.textSecondary }]} />
        <View style={styles.flagSlot}>
          <Icon name="flag" size={ICON_SIZE.body} color={colors.textSecondary} />
        </View>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('destination')}</Text>
      </View>
    </View>
  );
}

const BADGE = 30;
/** 虛線兩端離圖示的留白。 */
const CONNECTOR_GAP = 4;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { flex: 1, alignItems: 'center', gap: 2 },
  // 用上邊框畫虛線，貼齊圖示中心的高度；寬度交給 flex:1 的 step 平分（上一站中心 → 這一站中心）。
  // 兩端再各內縮半個圖示加留白：虛線畫在上一個圖示之後，不內縮會蓋過上一個圓點、穿過終點旗標（使用者回饋 2026-10-28）。
  connector: { position: 'absolute', top: BADGE / 2, left: '-50%', right: '50%', marginLeft: BADGE / 2 + CONNECTOR_GAP, borderTopWidth: 1.5, borderStyle: 'dashed' },
  connectorToBadge: { marginRight: BADGE / 2 + CONNECTOR_GAP },
  connectorToFlag: { marginRight: ICON_SIZE.body / 2 + CONNECTOR_GAP },
  iconBadge: { width: BADGE, height: BADGE, borderRadius: SHAPE.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  // 旗標跟圓點同高，虛線與「終點」字才會跟其他站對齊。
  flagSlot: { height: BADGE, justifyContent: 'center' },
  label: { fontSize: TYPE.caption, fontWeight: '600' },
  meta: { fontSize: TYPE.caption },
});
