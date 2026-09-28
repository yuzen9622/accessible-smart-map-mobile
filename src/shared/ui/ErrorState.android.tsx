import { StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';

import Button from './Button';
import type { ErrorStateProps } from './ErrorState.types';

export default function ErrorState({ title, description, retry }: ErrorStateProps) {
  const colors = useThemeColors();
  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={[title, description].filter(Boolean).join('。')}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {title}
      </Text>
      {description ? (
        <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
      ) : null}
      {retry ? (
        <View style={styles.retry}>
          <Button label={retry.label} onPress={retry.onPress} variant="secondary" />
        </View>
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
  retry: {
    marginTop: 16,
  },
});
