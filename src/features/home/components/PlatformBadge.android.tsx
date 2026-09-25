import { StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';

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
    borderRadius: 8,
    elevation: 2,
  },
  text: {
    fontWeight: '500',
  },
});
