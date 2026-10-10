import { Text } from '@/shared/ui/typography/Text';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ACCENT_FILL, ON_ACCENT_FILL, RADIUS, TYPE, useSemanticColors, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import type { FacilityDetailRow } from '../hooks/useFacilityDetail';
import type { FacilityDetailPanelProps } from './FacilityDetailPanel.types';

/**
 * 設施詳情（`(sheet)/facility/[id]`），iOS／Android 共用——設計 2a「原生清單」（2026-09-30）：
 * 類別 · 來源 → 名稱 → 主按鈕「規劃路線」＋「在地圖上顯示」圓鈕 → 分組資料列 →
 * 「現場跟資訊不一樣？」回報。
 *
 * 同 `PlaceDetailView`：列表圖示一律 Lucide（SDD ADR-16），SwiftUI `Form` 內放不了 RN 圖示，
 * 所以兩個平台共用這份 RN 版型；根節點是單一 `ScrollView`（iOS formSheet 的限制）。
 */
export default function FacilityDetailPanel({ model }: FacilityDetailPanelProps) {
  const colors = useThemeColors();
  const { fontScale } = useWindowDimensions();
  const semantic = useSemanticColors();
  const toneColor = (tone: FacilityDetailRow['tone']) => (tone ? semantic[tone].fg : colors.text);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>{model.eyebrow}</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {model.title}
        </Text>
      </View>

      <View style={[styles.actions, fontScale >= 1.3 && styles.actionsLarge]}>
        <Pressable
          accessibilityRole="button"
          onPress={model.onPlanRoute}
          style={({ pressed }) => [styles.primaryButton, fontScale >= 1.3 && styles.primaryButtonLarge, pressed && styles.pressed]}>
          <Icon name="navigation" color={ON_ACCENT_FILL} />
          <Text style={styles.primaryText}>{model.planRouteLabel}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={model.showOnMapLabel}
          onPress={model.onShowOnMap}
          style={({ pressed }) => [styles.circleButton, { backgroundColor: semantic.accentSoft }, pressed && styles.pressed]}>
          <Icon name="mapPin" size={20} color={semantic.accent} />
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: semantic.surface }]}>
        {model.rows.map((row, index) => (
          <View
            key={row.label}
            accessible
            accessibilityLabel={`${row.label}：${row.value}`}
            style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: semantic.separator }]}>
            <Icon name={row.icon} size={18} color={colors.textSecondary} />
            <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{row.label}</Text>
            <Text style={[styles.rowValue, { color: toneColor(row.tone) }, row.tone && styles.rowValueStrong]}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.feedback}>
        <Text style={[styles.feedbackText, { color: colors.text }]}>{model.mismatchLabel}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={model.reportAccessibilityLabel}
          onPress={model.onReport}
          style={({ pressed }) => [styles.reportButton, { backgroundColor: semantic.warn.bg }, pressed && styles.pressed]}>
          <Icon name="alert" size={16} color={semantic.warn.fg} />
          <Text style={[styles.reportText, { color: semantic.warn.fg }]}>{model.reportLabel}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32, gap: 16 },
  header: { gap: 4 },
  eyebrow: { fontSize: TYPE.subhead, fontWeight: '500' },
  title: { fontSize: TYPE.title, fontWeight: '700' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionsLarge: { flexWrap: 'wrap' },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: ACCENT_FILL,
  },
  primaryButtonLarge: { flexGrow: 0, flexBasis: '100%', paddingVertical: 10 },
  primaryText: { color: ON_ACCENT_FILL, fontSize: 17, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  circleButton: { width: 50, height: 50, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  card: { borderRadius: RADIUS.card, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 10 },
  rowLabel: { fontSize: TYPE.callout },
  rowValue: { flex: 1, fontSize: TYPE.callout, textAlign: 'right' },
  rowValueStrong: { fontWeight: '600' },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  feedbackText: { flex: 1, minWidth: 160, fontSize: TYPE.callout, fontWeight: '600' },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: RADIUS.pill,
  },
  reportText: { fontSize: TYPE.callout, fontWeight: '600' },
});
