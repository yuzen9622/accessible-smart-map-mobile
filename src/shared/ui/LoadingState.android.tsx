import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';

import type { LoadingStateProps } from './LoadingState.types';

const DEFAULT_LABEL = '載入中';

export default function LoadingState({ label = DEFAULT_LABEL }: LoadingStateProps) {
  const colors = useThemeColors();
  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={colors.text} />
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  label: {
    fontSize: 15,
  },
});
