import { ScrollView, StyleSheet, Text } from 'react-native';

import { useThemeColors } from '@/shared/theme';

import { SPIKE_LEGS, type SheetSpikeDetailProps } from './SheetSpikeDetail.types';

export default function SheetSpikeDetail({ legs = SPIKE_LEGS }: SheetSpikeDetailProps) {
  const colors = useThemeColors();
  return (
    <ScrollView contentContainerStyle={styles.content} style={{ backgroundColor: colors.background }}>
      {legs.map((leg) => (
        <Text key={leg.key} style={{ color: colors.text }}>
          {leg.mode}：{leg.summary}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 24, gap: 12 } });
