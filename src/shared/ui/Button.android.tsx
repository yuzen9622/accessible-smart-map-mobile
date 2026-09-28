import { Pressable, StyleSheet, Text } from 'react-native';

import { useThemeColors } from '@/shared/theme';

import type { ButtonProps } from './Button.types';

const MIN_TOUCH_TARGET = 48;

export default function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityHint,
}: ButtonProps) {
  const colors = useThemeColors();
  const isDestructive = variant === 'destructive';
  const backgroundColor = variant === 'primary' ? colors.text : colors.backgroundElement;
  const textColor = variant === 'primary' ? colors.background : isDestructive ? '#D92D20' : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: colors.textSecondary }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, opacity: disabled ? 0.5 : pressed ? 0.9 : 1 },
      ]}>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
});
