import { HStack, RNHostView } from '@expo/ui/swift-ui';
import { background, glassEffect, shapes, strokeBorder } from '@expo/ui/swift-ui/modifiers';
import type { ReactElement } from 'react';

import { useThemeColors } from '@/shared/theme';
import Host from '@/shared/ui/typography/PreferenceHost.ios';
import { useLiquidGlass } from '@/shared/ui/useLiquidGlass';

export default function EnvironmentChipSurface({ children }: { children: ReactElement }) {
  const colors = useThemeColors();
  const liquidGlass = useLiquidGlass();

  return (
    <Host matchContents>
      <HStack
        spacing={0}
        modifiers={liquidGlass
          ? [glassEffect({ glass: { variant: 'regular', interactive: true }, shape: 'capsule' })]
          : [
            background(colors.background, shapes.capsule()),
            strokeBorder({ content: colors.textSecondary, style: { lineWidth: 1 }, shape: 'capsule' }),
          ]}>
        <RNHostView matchContents>{children}</RNHostView>
      </HStack>
    </Host>
  );
}
