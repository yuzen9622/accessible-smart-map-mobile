import { StyleSheet, Text, View } from 'react-native';

import { TYPE, useSemanticColors } from '@/shared/theme';

interface RouteBadgeProps {
  name: string;
  /** 放在主色卡上時改成白底。 */
  onAccent?: boolean;
  /** 清單副標裡的小膠囊（站牌行經路線）。 */
  small?: boolean;
}

/** 路線號碼膠囊（設計 2b）：主色淡底＋主色字，長路名（忠孝新幹線）自動縮排不截字。 */
export default function RouteBadge({ name, onAccent, small }: RouteBadgeProps) {
  const semantic = useSemanticColors();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={[styles.badge, small && styles.badgeSmall, { backgroundColor: onAccent ? 'rgba(255,255,255,0.2)' : semantic.accentSoft }]}>
      <Text style={[styles.text, small && styles.textSmall, { color: onAccent ? '#FFFFFF' : semantic.accent }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { minWidth: 56, minHeight: 32, paddingHorizontal: 10, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeSmall: { minWidth: 0, minHeight: 22, paddingHorizontal: 7, borderRadius: 6 },
  text: { fontSize: TYPE.body, fontWeight: '700', fontVariant: ['tabular-nums'] },
  textSmall: { fontSize: TYPE.caption },
});
