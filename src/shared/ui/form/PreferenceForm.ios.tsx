import { Button as NativeButton, Form as NativeForm, Section as NativeSection, Text, VStack, type FormProps, type SectionProps } from '@expo/ui/swift-ui';
import { background, bold, foregroundStyle, listRowBackground, listRowSeparatorTint, scrollContentBackground, tint } from '@expo/ui/swift-ui/modifiers';
import type { ComponentProps, ReactNode } from 'react';

import { usePreferencesStore } from '@/shared/preferences/preferencesStore';
import { useSemanticColors, useThemeColors } from '@/shared/theme';

/** Keep SwiftUI's native form behavior; opt into the App palette only in high contrast. */
export function Form({ modifiers = [], ...props }: FormProps) {
  const highContrast = usePreferencesStore(s => s.highContrast);
  const colors = useThemeColors();
  return <NativeForm {...props} modifiers={highContrast ? [
    scrollContentBackground('hidden'), background(colors.backgroundElement), bold(), ...modifiers,
  ] : modifiers} />;
}

export function Section({ title, header, footer, modifiers = [], ...props }: SectionProps) {
  const highContrast = usePreferencesStore(s => s.highContrast);
  const colors = useThemeColors();
  const tones = useSemanticColors();
  if (!highContrast) return <NativeSection {...props} title={title} header={header} footer={footer} modifiers={modifiers} />;

  // Native section captions otherwise use a translucent secondary label, bypassing the App palette.
  const caption = (content: ReactNode) => content == null ? undefined : (
    <VStack alignment="leading" modifiers={[foregroundStyle(colors.textSecondary)]}>{content}</VStack>
  );
  return <NativeSection {...props}
    header={caption(header ?? (title ? <Text>{title}</Text> : undefined))}
    footer={caption(footer)}
    modifiers={[listRowBackground(colors.background), listRowSeparatorTint(tones.separator), ...modifiers]}
  />;
}

/** Explicit secondary labels also need an opaque color instead of SwiftUI's hierarchical opacity. */
export function useSecondaryForeground() {
  const highContrast = usePreferencesStore(s => s.highContrast);
  const colors = useThemeColors();
  return foregroundStyle(highContrast ? colors.textSecondary : { type: 'hierarchical', style: 'secondary' });
}

/** SwiftUI destructive roles use system red unless explicitly given the accessible danger color. */
export function Button({ modifiers = [], ...props }: ComponentProps<typeof NativeButton>) {
  const highContrast = usePreferencesStore(s => s.highContrast);
  const tones = useSemanticColors();
  return <NativeButton {...props} modifiers={highContrast && props.role === 'destructive'
    ? [...modifiers, tint(tones.danger.fg), foregroundStyle(tones.danger.fg)] : modifiers} />;
}
