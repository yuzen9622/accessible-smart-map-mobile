import { Text } from '@/shared/ui/typography/Text';
import { ScrollView, StyleSheet } from 'react-native';

import { SPACE, useSemanticColors, useThemeColors, TYPE, SHAPE, ICON_SIZE } from '@/shared/theme';
import { GlassCard, Icon } from '@/shared/ui';

import type { MapLayersBarProps } from './MapLayersBar.types';
import PressableScale from '@/shared/ui/PressableScale';

/**
 * 常駐貼在首頁 sheet 上緣的設施篩選列（取代方案 A 的「圖層」按鈕＋彈出選單，使用者回饋：
 * 右邊常駐的「圖層」入口跟彈出卡片不需要了，直接像搜尋框上方那樣貼著 sheet 常駐顯示）。
 * 電梯／坡道／廁所／停車每個都是獨立膠囊，點一下直接套用，選取中的反白；不需要再開合卡片。
 * 每顆各自一個白底膠囊（不是單一大卡片裡的色塊），放不下時橫向捲動，不會像擠在同一條列裡
 * 那樣互相擠壓文字寬度（使用者回饋截圖實測：擠在一起時標籤被截斷成「...」）。
 * 最後一顆是「行動需求」膠囊（例：「一般」），藍底跟其他白底切換膠囊區分開來——這是導去設定頁的
 * 入口，不是可以選取的篩選項（使用者回饋 2026-10-23：原本跟設施篩選分開兩處，合併成一條常駐列）。
 */
export default function MapLayersBar({ facilityToggles, needsPill }: MapLayersBarProps) {
  const colors = useThemeColors();
  const tones = useSemanticColors();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      accessibilityRole="none">
      {facilityToggles.map((item) => (
        <GlassCard key={item.key} style={styles.glass} interactive>
          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ selected: item.selected }}
            accessibilityLabel={item.label}
            onPress={item.onToggle}
            style={[styles.button, item.selected && { backgroundColor: tones.accentSoft }]}>
            <Icon name={item.iconName} size={ICON_SIZE.body} color={item.selected ? tones.accent : colors.textSecondary} />
            <Text style={[styles.label, { color: item.selected ? tones.accent : colors.text }]} numberOfLines={1}>
              {item.label}
            </Text>
          </PressableScale>
        </GlassCard>
      ))}
      {needsPill ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={needsPill.accessibilityLabel}
          onPress={needsPill.onPress}
          style={[styles.button, { backgroundColor: tones.accentSoft }]}>
          <Icon name="accessibility" size={ICON_SIZE.body} color={tones.accent} />
          <Text style={[styles.label, { color: tones.accent }]} numberOfLines={1}>
            {needsPill.label}
          </Text>
          <Icon name="chevronDown" size={ICON_SIZE.caption} color={tones.accent} />
        </PressableScale>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexDirection: 'row', gap: SPACE.sm },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: SPACE.md,
    borderRadius: SHAPE.pill, borderCurve: 'continuous',
  },
  glass: { borderRadius: SHAPE.pill },
  label: { fontSize: TYPE.subhead, fontWeight: '600' },
});
