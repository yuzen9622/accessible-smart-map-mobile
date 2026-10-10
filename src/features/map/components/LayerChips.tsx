import { Text } from '@/shared/ui/typography/Text';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ACCENT_FILL, useThemeColors } from '@/shared/theme';
import { GlassCard, Icon } from '@/shared/ui';

import type { LayerChipsProps } from './LayerChips.types';

/**
 * 首頁的地圖圖層開關（設計 1c「地圖優先」）：預設只露出一顆篩選切換鈕（貼在 sheet 上緣），
 * 點了才展開個別分類 chips；平常不讓整排 chips 一直佔掉地圖版面。開啟的圖層用實心主色＋勾，
 * 未開用 Liquid Glass（`GlassCard` 在 Android／降低透明度時退回不透明底）。iOS／Android 共用。
 */
export default function LayerChips({ chips, label, expanded, toggleLabel, onToggleExpanded }: LayerChipsProps) {
  const colors = useThemeColors();
  const activeCount = chips.filter((chip) => chip.selected).length;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={label}
      contentContainerStyle={styles.row}>
      <GlassCard interactive style={styles.glass}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={toggleLabel}
          accessibilityState={{ expanded }}
          onPress={onToggleExpanded}
          style={({ pressed }) => [styles.chip, styles.toggle, pressed && styles.pressed]}>
          <Icon name="listFilter" size={17} color={activeCount > 0 ? ACCENT_FILL : colors.text} />
          {activeCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: ACCENT_FILL }]}>
              <Text style={styles.badgeText}>{activeCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </GlassCard>
      {expanded
        ? chips.map((chip) =>
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
          )
        : null}
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
  toggle: { paddingHorizontal: 14 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
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
