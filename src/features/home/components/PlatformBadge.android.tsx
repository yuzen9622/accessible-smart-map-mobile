import { Text } from '@/shared/ui/typography/Text';
import { StyleSheet, View } from 'react-native';

import { useThemeColors, SHAPE, ELEVATION } from '@/shared/theme';

import type { PlatformBadgeProps } from './PlatformBadge.types';

export default function PlatformBadge({ label }: PlatformBadgeProps) {
  const colors = useThemeColors();
  return (
    <View
      style={[styles.badge, { backgroundColor: colors.backgroundElement }]}>
      <Text style={[styles.text, { color: colors.text }]}>{label} · Android</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: SHAPE.control, borderCurve: 'continuous',
    boxShadow: ELEVATION.raised,
  },
  text: {
    fontWeight: '600',
  },
});
