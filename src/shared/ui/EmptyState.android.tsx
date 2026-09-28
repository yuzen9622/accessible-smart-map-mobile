import { StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';

import type { EmptyStateProps } from './EmptyState.types';

export default function EmptyState({ title, description }: EmptyStateProps) {
  const colors = useThemeColors();
  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="text"
      accessibilityLabel={[title, description].filter(Boolean).join('。')}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {title}
      </Text>
      {description ? (
        <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
  },
});
