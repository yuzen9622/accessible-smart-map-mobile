import { Button as SwiftUIButton, Host, type ButtonRole } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, disabled as disabledModifier, frame } from '@expo/ui/swift-ui/modifiers';

import type { ButtonProps, ButtonVariant } from './Button.types';

const STYLE_BY_VARIANT: Record<ButtonVariant, 'borderedProminent' | 'bordered'> = {
  primary: 'borderedProminent',
  secondary: 'bordered',
  destructive: 'bordered',
};

const MIN_TOUCH_TARGET = 44;

export default function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  accessibilityHint,
}: ButtonProps) {
  const role: ButtonRole = variant === 'destructive' ? 'destructive' : 'default';
  const a11yLabel = accessibilityHint ? `${label}。${accessibilityHint}` : label;

  return (
    <Host matchContents style={{ minHeight: MIN_TOUCH_TARGET }}>
      <SwiftUIButton
        label={label}
        role={role}
        onPress={onPress}
        modifiers={[
          buttonStyle(STYLE_BY_VARIANT[variant]),
          frame({ minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET }),
          disabledModifier(disabled),
          accessibilityLabel(a11yLabel),
        ]}
      />
    </Host>
  );
}
