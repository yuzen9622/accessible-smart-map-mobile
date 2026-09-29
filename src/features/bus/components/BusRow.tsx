import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';
import { Icon, type IconName } from '@/shared/ui';

import { BUS_SELECTED_SURFACE, BUS_SURFACE_COLOR } from './palette';

interface BusRowProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** 右側附加內容（徽章、距離）。 */
  trailing?: ReactNode;
  showChevron?: boolean;
  selected?: boolean;
  /** 整列朗讀內容：一次唸完所有資訊。 */
  accessibilityLabel: string;
  onPress: () => void;
}

/** 面板通用列：整列可點、最小 44 pt、文字不固定高度（Dynamic Type）。 */
export default function BusRow({ title, subtitle, icon, trailing, showChevron, selected, accessibilityLabel, onPress }: BusRowProps) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: selected ?? false }}
      onPress={onPress}
      style={[styles.row, { backgroundColor: selected ? BUS_SELECTED_SURFACE : BUS_SURFACE_COLOR }]}>
      {icon ? <Icon name={icon} size={18} color={colors.textSecondary} /> : null}
      <View style={styles.texts}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {trailing}
      {showChevron ? <Icon name="chevronRight" size={16} color={colors.textSecondary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  texts: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { fontSize: 13 },
});
