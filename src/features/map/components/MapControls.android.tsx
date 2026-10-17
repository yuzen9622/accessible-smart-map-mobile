import { Text } from '@/shared/ui/typography/Text';
import { Pressable, StyleSheet, View } from 'react-native';

import { ACCENT_FILL, ON_ACCENT_FILL, useThemeColors } from '@/shared/theme';

import type { MapControlsProps } from './MapControls.types';

/** `primary` 用主色實心凸顯，其餘維持中性底色——跟 iOS 的 `glassProminent`／`glass` 對齊。 */
export default function MapControls({ actions }: MapControlsProps) {
  const colors = useThemeColors();
  return (
    <View style={styles.column}>
      {actions.map((action) => {
        const isPrimary = action.variant === 'primary';
        return (
          <Pressable
            key={action.key}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            style={[styles.button, { backgroundColor: isPrimary ? ACCENT_FILL : colors.backgroundElement }]}>
            <Text style={[styles.text, { color: isPrimary ? ON_ACCENT_FILL : colors.text }]}>{action.shortLabel}</Text>
          </Pressable>
        );
      })}
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
