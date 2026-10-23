import { Text } from '@/shared/ui/typography/Text';
import { StyleSheet, View } from 'react-native';

import { useThemeColors, TYPE } from '@/shared/theme';

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
    fontSize: TYPE.body,
    fontWeight: '600',
    textAlign: 'center',
  },
  description: {
    fontSize: TYPE.subhead,
    textAlign: 'center',
  },
  retry: {
    marginTop: 16,
  },
});
