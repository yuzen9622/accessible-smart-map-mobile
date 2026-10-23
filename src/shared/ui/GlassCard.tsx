import { StyleSheet, View } from 'react-native';

import { useThemeColors, SHAPE, ELEVATION } from '@/shared/theme';

import type { GlassCardProps } from './GlassCard.types';

/** Android／fallback：不透明卡片（SDD §4.5：沒有 Liquid Glass 時退回不透明底色）。 */
export default function GlassCard({ children, style }: GlassCardProps) {
  const colors = useThemeColors();
  return <View style={[styles.card, { backgroundColor: colors.background }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: SHAPE.floating, borderCurve: 'continuous',
    boxShadow: ELEVATION.floating,
  },
});
