import { Button, GlassEffectContainer, Host, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, controlSize, labelStyle } from '@expo/ui/swift-ui/modifiers';

import type { MapControlsProps } from './MapControls.types';

/** 地圖浮動按鈕：Liquid Glass，相鄰按鈕由 GlassEffectContainer 融合。 */
export default function MapControls({ actions }: MapControlsProps) {
  return (
    <Host matchContents>
      <GlassEffectContainer spacing={12}>
        <VStack spacing={12}>
          {actions.map((action) => (
            <Button
              key={action.key}
              label={action.label}
              systemImage={action.systemImage}
              onPress={action.onPress}
              modifiers={[labelStyle('iconOnly'), buttonStyle('glass'), controlSize('large')]}
            />
          ))}
        </VStack>
      </GlassEffectContainer>
    </Host>
  );
}
