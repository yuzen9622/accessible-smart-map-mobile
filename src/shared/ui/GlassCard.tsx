import { StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';

import type { GlassCardProps } from './GlassCard.types';

/** Android／fallback：不透明卡片（SDD §4.5：沒有 Liquid Glass 時退回不透明底色）。 */
export default function GlassCard({ children, style }: GlassCardProps) {
  const colors = useThemeColors();
  return <View style={[styles.card, { backgroundColor: colors.background }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
