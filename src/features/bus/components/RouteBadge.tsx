import { StyleSheet, useColorScheme, View } from 'react-native';

import { MODE, TYPE, WHITE, SHAPE } from '@/shared/theme';
import { Numeral } from '@/shared/ui/typography/Numeral';

interface RouteBadgeProps {
  name: string;
  /** 放在主色卡上時改成白底。 */
  onAccent?: boolean;
  /** 清單副標裡的小膠囊（站牌行經路線）。 */
  small?: boolean;
}

/** 路線號碼膠囊：公車色淡底＋公車色字（同一個實體在任何地方顏色相同），長路名（忠孝新幹線）自動縮排不截字。 */
export default function RouteBadge({ name, onAccent, small }: RouteBadgeProps) {
  const isDark = useColorScheme() === 'dark';
  const busText = isDark ? MODE.bus.line : MODE.bus.text;
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={[styles.badge, small && styles.badgeSmall, { backgroundColor: onAccent ? 'rgba(255,255,255,0.2)' : `${MODE.bus.line}1F` }]}>
      <Numeral style={[styles.text, small && styles.textSmall, { color: onAccent ? WHITE : busText }]} numberOfLines={1}>
        {name}
      </Numeral>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { minWidth: 56, minHeight: 32, paddingHorizontal: 10, borderRadius: SHAPE.control, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  badgeSmall: { minWidth: 0, minHeight: 22, paddingHorizontal: 7, borderRadius: SHAPE.badge, borderCurve: 'continuous' },
  text: { fontSize: TYPE.body, fontWeight: '700' },
  textSmall: { fontSize: TYPE.caption },
});
