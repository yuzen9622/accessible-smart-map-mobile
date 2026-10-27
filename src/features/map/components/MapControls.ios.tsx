import { Button, Label, VStack } from '@expo/ui/swift-ui';
import { background, buttonStyle, contentShape, font, foregroundStyle, frame, glassEffect, labelStyle, shapes, strokeBorder } from '@expo/ui/swift-ui/modifiers';

import { ICON_SIZE, useThemeColors } from '@/shared/theme';
import { useLiquidGlass } from '@/shared/ui/useLiquidGlass';
import Host from '@/shared/ui/typography/PreferenceHost.ios';

import type { MapControlsProps } from './MapControls.types';

/** 共用一個玻璃膠囊；每個動作保留獨立的 48pt 觸控區域。 */
export default function MapControls({ actions }: MapControlsProps) {
  const colors = useThemeColors();
  const liquidGlass = useLiquidGlass();
  return (
    <Host matchContents>
      <VStack
        spacing={0}
        modifiers={liquidGlass
          ? [glassEffect({ glass: { variant: 'regular' }, shape: 'capsule' })]
          : [
            background(colors.background, shapes.capsule()),
            strokeBorder({ content: colors.textSecondary, style: { lineWidth: 1 }, shape: 'capsule' }),
          ]}>
        {actions.map((action) => (
          <Button key={action.key} onPress={action.onPress} modifiers={[buttonStyle('plain')]}>
            <Label
              title={action.label}
              systemImage={action.systemImage}
              modifiers={[
                labelStyle('iconOnly'),
                font({ size: ICON_SIZE.map }),
                foregroundStyle(colors.text),
                frame({ width: 48, height: 48 }),
                contentShape(shapes.rectangle()),
              ]}
            />
          </Button>
        ))}
      </VStack>
    </Host>
  );
}
