import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ACCENT_FILL, ON_ACCENT_FILL, RADIUS, TYPE, useSemanticColors, useThemeColors } from '@/shared/theme';
import { Icon, SegmentedControl, type IconName } from '@/shared/ui';

import { FACILITY_COLORS } from '../domain/facilityStyle';
import type { NearbyRow } from '../hooks/useNearbyViewModel';
import type { NearbyPanelProps } from './NearbyPanel.types';

/** 與 `ParkingLayer` 的停車點同色。 */
const PARKING_ICON_COLOR = '#3949AB';

function rowIcon(category: NearbyRow['category']): { name: IconName; color: string } {
  if (category === 'parking') return { name: 'parking', color: PARKING_ICON_COLOR };
  return { name: category, color: FACILITY_COLORS[category] };
}

/**
 * 附近無障礙設施清單（`(sheet)/nearby`），iOS／Android 共用——設計 2a「原生清單」（2026-09-30）：
 * 分類 segmented 帶數量 → 「依距離排序 · 2 km 內」→ 分組列表（類別色圓形圖示、名稱、來源 · 出口、距離）
 * → 資料來源。
 *
 * 不用 SwiftUI `Form`：清單圖示一律 Lucide（SDD ADR-16），`@expo/ui` Host 內不能放 RN 子元件；
 * 同 `PlaceDetailView` 的做法改用 RN 版型，平台差異交給 `SegmentedControl` 的平台檔。
 * 根節點是單一 `ScrollView`（iOS formSheet 的限制）。
 */
export default function NearbyPanel({ model, onRequestLocation, labels }: NearbyPanelProps) {
  const colors = useThemeColors();
  const semantic = useSemanticColors();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <SegmentedControl
        label={labels.filterLabel}
        options={model.filters}
        onSelect={model.onSelectFilter}
      />

      <Text style={[styles.note, { color: colors.textSecondary }]}>{model.sortNote}</Text>

      {model.status === 'loading' ? (
        <View style={styles.message} accessibilityLabel={labels.loading}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      ) : null}
      {model.status === 'error' || model.status === 'empty' ? (
        <View style={styles.message}>
          <Text accessibilityLiveRegion="polite" style={[styles.messageText, { color: colors.textSecondary }]}>
            {model.status === 'error' ? (model.errorMessage ?? labels.empty) : labels.empty}
          </Text>
        </View>
      ) : null}
      {model.status === 'no-location' ? (
        <View style={styles.message}>
          <Text style={[styles.messageText, { color: colors.textSecondary }]}>{labels.noLocation}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onRequestLocation}
            style={({ pressed }) => [styles.locateButton, pressed && styles.pressed]}>
            <Icon name="crosshair" size={18} color={ON_ACCENT_FILL} />
            <Text style={styles.locateText}>{labels.locate}</Text>
          </Pressable>
        </View>
      ) : null}

      {model.rows.length > 0 ? (
        <View style={[styles.card, { backgroundColor: semantic.surface }]}>
          {model.rows.map((row, index) => {
            const icon = rowIcon(row.category);
            return (
              <Pressable
                key={row.key}
                accessibilityRole="button"
                accessibilityLabel={row.accessibilityLabel}
                onPress={row.onPress}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: semantic.separator },
                  pressed && styles.pressed,
                ]}>
                <View style={[styles.iconCircle, { backgroundColor: icon.color }]}>
                  <Icon name={icon.name} size={18} color={ON_ACCENT_FILL} />
                </View>
                <View style={styles.rowTexts}>
                  <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
                    {row.title}
                  </Text>
                  {row.subtitle ? (
                    <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                      {row.subtitle}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.distance, { color: colors.text }]}>{row.distanceText}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {model.sourcesNote ? (
        <View style={styles.footer}>
          <Icon name="info" size={14} color={colors.textSecondary} />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>{model.sourcesNote}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // paddingTop 多留一點：透明導覽列底緣的 scroll-edge 效果會蓋到第一行
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 12 },
  note: { fontSize: TYPE.subhead, paddingHorizontal: 4 },
  message: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  messageText: { fontSize: TYPE.callout, textAlign: 'center' },
  locateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: RADIUS.pill,
    backgroundColor: ACCENT_FILL,
  },
  locateText: { color: ON_ACCENT_FILL, fontSize: TYPE.body, fontWeight: '600' },
  card: { borderRadius: RADIUS.card, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 10 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rowTexts: { flex: 1, gap: 2 },
  rowTitle: { fontSize: TYPE.body, fontWeight: '600' },
  rowSubtitle: { fontSize: TYPE.subhead },
  distance: { fontSize: TYPE.callout, fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.6 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  footerText: { flex: 1, fontSize: TYPE.caption },
});
