import { Text } from '@/shared/ui/typography/Text';
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { ACCENT_FILL, ON_ACCENT_FILL, RADIUS, useThemeColors } from '@/shared/theme';
import { usePreferencesStore } from '@/shared/preferences/preferencesStore';

import type { SegmentedControlProps } from './SegmentedControl.types';

export type SegmentedControlVariant = 'ios' | 'material';

interface BaseProps<T extends string> extends SegmentedControlProps<T> {
  variant: SegmentedControlVariant;
}

/**
 * 一次只能選一個的分段控制（iOS segmented control 的外觀：灰色軌道＋白色浮起的選中塊；
 * Android 變體用主色填滿選中段）。不用 SwiftUI Picker：面板根節點是 RN ScrollView，
 * `@expo/ui` Host 的 matchContents 會讓 100% 寬度塌成 0，而 RN 版可以完整帶上 selected／disabled 語意。
 */
export default function SegmentedControlBase<T extends string>({ label, options, onSelect, variant }: BaseProps<T>) {
  const colors = useThemeColors();
  const highContrast = usePreferencesStore(s => s.highContrast);
  const isDark = useColorScheme() === 'dark';
  const ios = variant === 'ios';
  const track = isDark ? 'rgba(118,118,128,0.24)' : 'rgba(120,120,128,0.12)';
  const thumb = isDark ? '#636366' : '#FFFFFF';

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.track, { backgroundColor: highContrast ? colors.backgroundElement : track, borderRadius: ios ? RADIUS.small : RADIUS.pill }]}>
      {options.map((option) => {
        const selectedStyle = highContrast ? { backgroundColor: colors.text }
          : ios ? [styles.thumb, { backgroundColor: thumb }] : { backgroundColor: ACCENT_FILL };
        const textColor = option.selected && highContrast ? colors.background
          : option.selected && !ios ? ON_ACCENT_FILL : colors.text;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            accessibilityState={{ selected: option.selected, disabled: option.disabled }}
            disabled={option.disabled}
            onPress={() => onSelect(option.value)}
            style={[styles.segment, { borderRadius: ios ? 8 : RADIUS.pill }, option.selected && selectedStyle]}>
            <Text numberOfLines={1} style={[styles.text, { color: textColor, fontWeight: option.selected ? '600' : '500' }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 2, gap: 2 },
  // 40 + 軌道上下 padding 2 = 44pt 觸控高度（SDD §10）
  segment: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  thumb: {
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  text: { fontSize: 13 },
});
