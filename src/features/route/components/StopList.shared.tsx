import { StyleSheet, View } from 'react-native';

import { haptic } from '@/shared/haptics';
import { ICON_SIZE, SHAPE, TYPE, WHITE, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';
import PressableScale from '@/shared/ui/PressableScale';
import { Text } from '@/shared/ui/typography/Text';

import { ROUTE_WAYPOINT_COLOR } from '../domain/routeLayerData';
import type { PlanStop } from '../hooks/useRoutePlanViewModel';
import type { StopListLabels } from './StopList.types';
import { ROUTE_BORDER_COLOR, routeStyles } from './palette';

/** 左側標記欄的寬度；起訖點列與停靠點列共用，虛線才會對齊。 */
export const STOP_MARKER_WIDTH = 22;
/** 單列最小高度（觸控目標 44pt）。 */
export const STOP_ROW_MIN_HEIGHT = 44;

/** 列與列之間的分隔線：左側標記欄畫三個小點把上下兩個地點連起來，右側是一般的細線。 */
export function RailDivider({ dotColor }: { dotColor: string }) {
  return (
    <View style={styles.railDivider}>
      <View style={styles.rail}>
        {[0, 1, 2].map((i) => <View key={i} style={[styles.railDot, { backgroundColor: dotColor }]} />)}
      </View>
      <View style={[styles.railLine, { backgroundColor: ROUTE_BORDER_COLOR }]} />
    </View>
  );
}

export interface StopRowProps {
  stop: PlanStop;
  labels: StopListLabels;
  /** 把手旁邊的拖曳區（Android 的 JS 拖曳把手）；iOS 由原生 List 長按整列拖曳，只畫圖示。 */
  handle?: React.ReactNode;
}

/** 單一停靠點列（含上方的虛線分隔）：編號、名稱（點擊重新搜尋）、移除、排序把手。 */
export function StopRow({ stop, labels, handle }: StopRowProps) {
  const colors = useThemeColors();
  return (
    <View>
      <RailDivider dotColor={colors.textSecondary} />
      <View style={styles.row}>
        <View style={styles.markerSlot}>
          <View style={[styles.badge, { backgroundColor: ROUTE_WAYPOINT_COLOR }]}>
            <Text style={styles.badgeText} maxFontSizeMultiplier={1.2}>{stop.badge}</Text>
          </View>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={stop.accessibilityLabel}
          accessibilityHint={labels.reorderHint}
          accessibilityActions={[
            ...(stop.onMoveUp ? [{ name: 'moveUp', label: labels.moveUp }] : []),
            ...(stop.onMoveDown ? [{ name: 'moveDown', label: labels.moveDown }] : []),
            { name: 'remove', label: labels.removeStop },
          ]}
          onAccessibilityAction={({ nativeEvent }) => {
            if (nativeEvent.actionName === 'moveUp') stop.onMoveUp?.();
            else if (nativeEvent.actionName === 'moveDown') stop.onMoveDown?.();
            else if (nativeEvent.actionName === 'remove') stop.onRemove();
          }}
          onPress={stop.onEdit}
          style={[routeStyles.flex, styles.press]}>
          <Text style={[routeStyles.bodyText, { color: colors.text }]} numberOfLines={1}>
            {stop.label}
          </Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${labels.removeStop}：${stop.label}`}
          onPress={() => {
            haptic.select();
            stop.onRemove();
          }}
          hitSlop={10}>
          <Icon name="close" size={ICON_SIZE.body} color={colors.textSecondary} />
        </PressableScale>
        {handle ?? <Icon name="reorder" size={ICON_SIZE.body} color={colors.textSecondary} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  railDivider: { flexDirection: 'row', alignItems: 'center', height: StyleSheet.hairlineWidth },
  rail: { position: 'absolute', left: 9, top: -8, gap: 3 },
  railDot: { width: 3, height: 3, borderRadius: SHAPE.pill, opacity: 0.6 },
  railLine: { flex: 1, height: StyleSheet.hairlineWidth, marginLeft: STOP_MARKER_WIDTH + 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: STOP_ROW_MIN_HEIGHT },
  markerSlot: { width: STOP_MARKER_WIDTH, alignItems: 'center', justifyContent: 'center' },
  press: { minHeight: STOP_ROW_MIN_HEIGHT, justifyContent: 'center' },
  badge: { width: 20, height: 20, borderRadius: SHAPE.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: WHITE, fontSize: TYPE.caption, fontWeight: '700' },
});
