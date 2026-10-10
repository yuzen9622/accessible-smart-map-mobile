import { Text } from '@/shared/ui/typography/Text';
import { StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';

import type { PlatformBadgeProps } from './PlatformBadge.types';

export default function PlatformBadge({ label }: PlatformBadgeProps) {
  const colors = useThemeColors();
  return (
    <View style={[styles.badge, { backgroundColor: colors.backgroundElement }]}>
      <Text style={[styles.text, { color: colors.text }]}>{label} · iOS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderCurve: 'continuous',
  },
  text: {
    fontWeight: '600',
  },
});
