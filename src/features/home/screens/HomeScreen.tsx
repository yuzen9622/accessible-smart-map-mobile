import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeColors } from '@/shared/theme';

import PlatformBadge from '../components/PlatformBadge';

export default function HomeScreen() {
  const colors = useThemeColors();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>臺北無障礙導航</Text>
      <Text style={{ color: colors.textSecondary }}>Expo SDK 57 · React Native 0.86</Text>
      <PlatformBadge label="Platform" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
});
