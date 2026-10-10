import Host from '@/shared/ui/typography/PreferenceHost.ios';
import { Button, GlassEffectContainer, VStack } from '@expo/ui/swift-ui';
import { background, buttonStyle, controlSize, dynamicTypeSize, foregroundStyle, frame, labelStyle, shapes } from '@expo/ui/swift-ui/modifiers';

import { usePreferencesStore } from '@/shared/preferences/preferencesStore';
import { useThemeColors } from '@/shared/theme';

import type { MapControlsProps } from './MapControls.types';

/** 地圖浮動按鈕：Liquid Glass，相鄰按鈕由 GlassEffectContainer 融合。 */
export default function MapControls({ actions }: MapControlsProps) {
  const highContrast = usePreferencesStore(s => s.highContrast);
  const colors = useThemeColors();
  return (
    // 字級上限 xxxLarge：最大無障礙字級時這兩顆圓鈕會放大到蓋住下方的 SOS 按鈕（截圖實測），緊急功能不能被遮
    <Host matchContents modifiers={[dynamicTypeSize({ max: 'xxxLarge' })]}>
      <GlassEffectContainer spacing={12}>
        <VStack spacing={12}>
          {actions.map((action) => (
            <Button
              key={action.key}
              label={action.label}
              systemImage={action.systemImage}
              onPress={action.onPress}
              modifiers={[
                labelStyle('iconOnly'), buttonStyle(highContrast ? 'plain' : 'glass'), controlSize('large'),
                ...(highContrast ? [frame({ width: 48, height: 48 }), foregroundStyle(colors.text), background(colors.background, shapes.circle())] : []),
              ]}
            />
          ))}
        </VStack>
      </GlassEffectContainer>
    </Host>
  );
}
