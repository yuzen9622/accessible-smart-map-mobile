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

/**
 * 永遠走 `header`、不要把 `title` 原生 prop 傳給 `NativeSection`，兩種模式都一樣：原生
 * `SectionView.swift` 的 `regularSection` 是 `if let title { … } else if let headerView,
 * let footerView { … } else if let headerView { … } else { … }` 這種 `@ViewBuilder if/else`
 * 鏈，`title`／`header` 哪個有值會決定走哪一條分支。高對比切換時這裡以前是「有 title 沒
 * header」切到「沒 title 有 header」，等於每個 Section 同時換分支、整個 Form 被砍重建，
 * 捲動位置就彈回最頂端（使用者回饋 2026-10-25 錄影）。固定都走 header，分支永遠一致，只是
 * 換字的顏色。
 */
export function Section({ title, header, footer, modifiers = [], ...props }: SectionProps) {
  const highContrast = usePreferencesStore(s => s.highContrast);
  const colors = useThemeColors();
  const tones = useSemanticColors();

  const captionColor = highContrast ? colors.textSecondary : ({ type: 'hierarchical', style: 'secondary' } as const);
  const caption = (content: ReactNode) => content == null ? undefined : (
    <VStack alignment="leading" modifiers={[foregroundStyle(captionColor)]}>{content}</VStack>
  );
  return <NativeSection {...props}
    header={caption(header ?? (title ? <Text>{title}</Text> : undefined))}
    footer={caption(footer)}
    modifiers={highContrast ? [listRowBackground(colors.background), listRowSeparatorTint(tones.separator), ...modifiers] : modifiers}
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
