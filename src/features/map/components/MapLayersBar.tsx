import { Pressable, StyleSheet, View } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { RADIUS, useSemanticColors, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import type { MapLayersBarProps } from './MapLayersBar.types';

/**
 * 常駐橫向圖層捷徑列（取代方案 A 的「圖層」彈出選單，使用者回饋：開合選單多一步、
 * 設施圖示分類不直覺）。2D／3D 視角切換 + 電梯／坡道／廁所／停車每個都是獨立按鈕，
 * 點一下直接套用，選取中的按鈕反白；不需要再開合卡片。
 */
export default function MapLayersBar({ is3d, onToggle3d, facilityToggles }: MapLayersBarProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const tones = useSemanticColors();

  const items = [
    { key: '3d', label: t('switchTo3D'), iconName: 'cuboid' as const, selected: is3d, onToggle: onToggle3d },
    ...facilityToggles,
  ];

  return (
    <View style={[styles.bar, { backgroundColor: colors.backgroundElement }]}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole="button"
          accessibilityState={{ selected: item.selected }}
          accessibilityLabel={item.label}
          onPress={item.onToggle}
          style={[styles.button, item.selected && { backgroundColor: tones.accentSoft }]}>
          <Icon name={item.iconName} size={20} color={item.selected ? tones.accent : colors.textSecondary} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderRadius: RADIUS.pill,
    padding: 4,
    gap: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  button: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
