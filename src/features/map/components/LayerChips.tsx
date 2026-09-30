import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { ACCENT_FILL, useThemeColors } from '@/shared/theme';
import { GlassCard, Icon } from '@/shared/ui';

import type { LayerChipsProps } from './LayerChips.types';

/**
 * 首頁的地圖圖層開關（設計 1b「需求優先」）：一排貼在 sheet 上緣的玻璃 chips，
 * 開啟的圖層用實心主色＋勾，未開用 Liquid Glass（`GlassCard` 在 Android／降低透明度時退回不透明底）。
 * iOS／Android 共用：平台差異已封裝在 `GlassCard`。
 */
export default function LayerChips({ chips, label }: LayerChipsProps) {
  const colors = useThemeColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={label}
      contentContainerStyle={styles.row}>
      {chips.map((chip) =>
        chip.selected ? (
          <Pressable
            key={chip.key}
            accessibilityRole="switch"
            accessibilityLabel={chip.label}
            accessibilityState={{ checked: true }}
            onPress={chip.onToggle}
            style={({ pressed }) => [styles.chip, styles.selected, pressed && styles.pressed]}>
            <Icon name="check" size={15} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={[styles.label, styles.selectedLabel]}>{chip.label}</Text>
          </Pressable>
        ) : (
          <GlassCard key={chip.key} interactive style={styles.glass}>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel={chip.label}
              accessibilityState={{ checked: false }}
              onPress={chip.onToggle}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
              <Text style={[styles.label, { color: colors.text }]}>{chip.label}</Text>
            </Pressable>
          </GlassCard>
        ),
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  glass: { borderRadius: 20 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
  },
  selected: {
    backgroundColor: ACCENT_FILL,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
  },
  label: { fontSize: 15, fontWeight: '600' },
  selectedLabel: { color: '#FFFFFF' },
  pressed: { opacity: 0.7 },
});
