import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';

import { BUS_ACCENT_COLOR, BUS_BORDER_COLOR, BUS_ON_ACCENT_COLOR } from './palette';

export interface PillOption<T extends string | number> {
  value: T;
  label: string;
}

interface SegmentedPillsProps<T extends string | number> {
  options: PillOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}

/** 切換用 pill 群組（找路線／找站牌、方向）：每顆都是 button＋selected 狀態，≥ 44 pt。 */
export default function SegmentedPills<T extends string | number>({ options, value, onChange }: SegmentedPillsProps<T>) {
  const colors = useThemeColors();
  return (
    <View style={styles.group}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.pill, { borderColor: BUS_BORDER_COLOR }, selected && styles.pillSelected]}>
            <Text style={[styles.text, { color: selected ? BUS_ON_ACCENT_COLOR : colors.text }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  pillSelected: { backgroundColor: BUS_ACCENT_COLOR, borderColor: BUS_ACCENT_COLOR },
  text: { fontSize: 15, fontWeight: '600' },
});
