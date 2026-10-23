import { Text } from '@/shared/ui/typography/Text';
import { StyleSheet } from 'react-native';

import { useThemeColors, DESTRUCTIVE_TEXT, TYPE, SHAPE, ELEVATION } from '@/shared/theme';

import type { ButtonProps } from './Button.types';
import PressableScale from '@/shared/ui/PressableScale';

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
  const textColor = variant === 'primary' ? colors.background : isDestructive ? DESTRUCTIVE_TEXT : colors.text;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={[styles.button, { backgroundColor, opacity: disabled ? 0.5 : 1 }]}>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    paddingHorizontal: 20,
    borderRadius: SHAPE.control, borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: ELEVATION.raised,
  },
  label: {
    fontSize: TYPE.callout,
    fontWeight: '600',
  },
});
