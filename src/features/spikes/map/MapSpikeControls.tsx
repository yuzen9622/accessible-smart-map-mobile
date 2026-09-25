import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';

import type { MapSpikeControlsProps } from './MapSpikeControls.types';

export default function MapSpikeControls({ actions }: MapSpikeControlsProps) {
  const colors = useThemeColors();
  return (
    <View style={styles.column}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={[styles.button, { backgroundColor: colors.backgroundElement }]}>
          <Text style={{ color: colors.text }}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 8 },
  button: { minHeight: 48, minWidth: 48, paddingHorizontal: 12, borderRadius: 24, justifyContent: 'center' },
});
