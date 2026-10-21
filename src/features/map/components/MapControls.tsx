import { Text } from '@/shared/ui/typography/Text';
import { Pressable, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';

import type { MapControlsProps } from './MapControls.types';

export default function MapControls({ actions }: MapControlsProps) {
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
          <Text style={[styles.text, { color: colors.text }]}>{action.shortLabel}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 12 },
  button: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  text: { fontWeight: '600' },
});
