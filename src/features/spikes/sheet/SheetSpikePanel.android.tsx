import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';

import type { SheetSpikePanelProps } from './SheetSpikePanel.types';

export default function SheetSpikePanel({ onOpenDetail }: SheetSpikePanelProps) {
  const colors = useThemeColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={{ color: colors.text }}>起點：目前位置 → 終點：台北 101</Text>
      <Pressable accessibilityRole="button" onPress={onOpenDetail} style={styles.button}>
        <Text style={{ color: colors.text }}>查看路線詳情</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16 },
  button: { minHeight: 48, justifyContent: 'center' },
});
