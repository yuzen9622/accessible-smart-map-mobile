import { Text } from '@/shared/ui/typography/Text';
import { StyleSheet, View } from 'react-native';

import { useThemeColors, SHAPE, ELEVATION } from '@/shared/theme';

import type { MapControlsProps } from './MapControls.types';
import PressableScale from '@/shared/ui/PressableScale';

export default function MapControls({ actions }: MapControlsProps) {
  const colors = useThemeColors();
  return (
    <View style={styles.column}>
      {actions.map((action) => (
        <PressableScale
          key={action.key}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={[styles.button, { backgroundColor: colors.backgroundElevated, borderColor: colors.elevatedBorder }]}>
          <Text style={[styles.text, { color: colors.text }]}>{action.shortLabel}</Text>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 12 },
  button: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: SHAPE.pill, borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: ELEVATION.floating,
  },
  text: { fontWeight: '600' },
});
