import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';
import { Button } from '@/shared/ui';

import type { NearbyPanelProps } from './NearbyPanel.types';

export default function NearbyPanel({ model, onRequestLocation, labels }: NearbyPanelProps) {
  const colors = useThemeColors();
  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={[styles.section, { color: colors.textSecondary }]}>
        {labels.filterHint}
      </Text>
      {model.toggles.map((toggle) => (
        <View key={toggle.category} style={styles.row}>
          <Text style={[styles.title, { color: colors.text }]}>{toggle.label}</Text>
          <Switch
            accessibilityLabel={toggle.label}
            value={toggle.isOn}
            onValueChange={toggle.onToggle}
          />
        </View>
      ))}
      <Text accessibilityRole="header" style={[styles.section, { color: colors.textSecondary }]}>
        {labels.nearbyTitle}
      </Text>
      {model.status === 'loading' ? <ActivityIndicator accessibilityLabel={labels.loading} /> : null}
      {model.status === 'error' || model.status === 'empty' ? (
        <Text style={{ color: colors.text }}>{model.errorMessage ?? labels.empty}</Text>
      ) : null}
      {model.status === 'no-location' ? <Button label={labels.locate} onPress={onRequestLocation} /> : null}
      {model.rows.map((row) => (
        <Pressable
          key={row.key}
          accessibilityRole="button"
          accessibilityLabel={row.accessibilityLabel}
          onPress={row.onPress}
          style={styles.row}>
          <View style={styles.texts}>
            <Text style={[styles.title, { color: colors.text }]}>{row.title}</Text>
            <Text style={{ color: colors.textSecondary }}>{row.subtitle}</Text>
          </View>
          <Text style={{ color: colors.textSecondary }}>{row.distanceText}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  section: { marginTop: 12, fontSize: 13, fontWeight: '600' },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  texts: { flex: 1 },
  title: { fontSize: 16 },
});
