import { Text } from '@/shared/ui/typography/Text';
import { Pressable, StyleSheet, View } from 'react-native';

import { RADIUS, SPACE, useSemanticColors, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import type { MapLayersBarProps } from './MapLayersBar.types';

/**
 * 常駐橫向圖層捷徑列（取代方案 A 的「圖層」彈出選單，使用者回饋：開合選單多一步、
 * 設施圖示分類不直覺）。電梯／坡道／廁所／停車每個都是獨立按鈕，點一下直接套用，選取中的
 * 按鈕反白；不需要再開合卡片。帶文字標籤，不是純圖示圓鈕——純圖示時使用者分不出每顆在篩
 * 什麼類別（使用者回饋）。
 */
export default function MapLayersBar({ facilityToggles }: MapLayersBarProps) {
  const colors = useThemeColors();
  const tones = useSemanticColors();

  return (
    <View style={[styles.bar, { backgroundColor: colors.backgroundElement }]}>
      {facilityToggles.map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole="button"
          accessibilityState={{ selected: item.selected }}
          accessibilityLabel={item.label}
          onPress={item.onToggle}
          style={[styles.button, item.selected && { backgroundColor: tones.accentSoft }]}>
          <Icon name={item.iconName} size={18} color={item.selected ? tones.accent : colors.textSecondary} />
          <Text style={[styles.label, { color: item.selected ? tones.accent : colors.text }]} numberOfLines={1}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    // 4 顆帶文字標籤的按鈕排一列會超出畫面寬度（使用者回饋截圖實測：最左邊那顆被切掉），
    // 限制寬度讓它自然換行成兩列。
    maxWidth: 220,
    borderRadius: RADIUS.card,
    padding: 4,
    gap: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.pill,
  },
  label: { fontSize: 14, fontWeight: '600' },
});
