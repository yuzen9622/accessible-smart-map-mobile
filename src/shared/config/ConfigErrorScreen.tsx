import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeColors } from '@/shared/theme';

import { CONFIG_ERROR_TITLE, type ConfigErrorScreenProps } from './ConfigErrorScreen.types';

export default function ConfigErrorScreen({ errors }: ConfigErrorScreenProps) {
  const colors = useThemeColors();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {CONFIG_ERROR_TITLE}
        </Text>
        {errors.map((error) => (
          <Text key={error} style={{ color: colors.textSecondary }}>
            {error}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
});
