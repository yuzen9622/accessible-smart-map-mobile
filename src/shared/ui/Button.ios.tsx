import Host from '@/shared/ui/typography/PreferenceHost.ios';
import { Button as SwiftUIButton, type ButtonRole } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, disabled as disabledModifier, foregroundStyle, frame, tint } from '@expo/ui/swift-ui/modifiers';
import { usePreferencesStore } from '@/shared/preferences/preferencesStore';
import { useSemanticColors, useThemeColors } from '@/shared/theme';

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
  const highContrast = usePreferencesStore(s => s.highContrast);
  const colors = useThemeColors();
  const tones = useSemanticColors();
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
          ...(highContrast ? [
            tint(variant === 'primary' ? colors.text : variant === 'destructive' ? tones.danger.fg : tones.accent),
            foregroundStyle(variant === 'primary' ? colors.background : variant === 'destructive' ? tones.danger.fg : tones.accent),
          ] : []),
        ]}
      />
    </Host>
  );
}
