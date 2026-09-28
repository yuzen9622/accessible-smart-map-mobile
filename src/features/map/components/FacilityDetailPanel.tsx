import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';
import { Button } from '@/shared/ui';

import type { FacilityDetailPanelProps } from './FacilityDetailPanel.types';

export default function FacilityDetailPanel({ title, rows, showOnMapLabel, onShowOnMap }: FacilityDetailPanelProps) {
  const colors = useThemeColors();
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {title}
      </Text>
      {rows.map((row) => (
        <View key={row.label} style={styles.row} accessible accessibilityLabel={`${row.label}：${row.value}`}>
          <Text style={{ color: colors.textSecondary }}>{row.label}</Text>
          <Text style={{ color: colors.text }}>{row.value}</Text>
        </View>
      ))}
      <Button label={showOnMapLabel} onPress={onShowOnMap} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  row: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
