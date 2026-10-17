import Host from '@/shared/ui/typography/PreferenceHost.ios';
import { Button, GlassEffectContainer, VStack } from '@expo/ui/swift-ui';
import { background, buttonStyle, controlSize, dynamicTypeSize, foregroundStyle, frame, labelStyle, shapes, tint } from '@expo/ui/swift-ui/modifiers';

import { usePreferencesStore } from '@/shared/preferences/preferencesStore';
import { ACCENT_FILL, ON_ACCENT_FILL, useThemeColors } from '@/shared/theme';

import type { MapControlsProps } from './MapControls.types';

/** 地圖浮動按鈕：Liquid Glass，相鄰按鈕由 GlassEffectContainer 融合。`primary` 用 `glassProminent`
 * 套主色 tint 凸顯，跟中性的 `glass` 按鈕拉開視覺層級。 */
export default function MapControls({ actions }: MapControlsProps) {
  const highContrast = usePreferencesStore(s => s.highContrast);
  const colors = useThemeColors();
  return (
    // 字級上限 xxxLarge：最大無障礙字級時這兩顆圓鈕會放大到蓋住下方的 SOS 按鈕（截圖實測），緊急功能不能被遮
    <Host matchContents modifiers={[dynamicTypeSize({ max: 'xxxLarge' })]}>
      <GlassEffectContainer spacing={12}>
        <VStack spacing={12}>
          {actions.map((action) => {
            const isPrimary = action.variant === 'primary';
            return (
              <Button
                key={action.key}
                label={action.label}
                systemImage={action.systemImage}
                onPress={action.onPress}
                modifiers={[
                  labelStyle('iconOnly'),
                  buttonStyle(highContrast ? 'plain' : isPrimary ? 'glassProminent' : 'glass'),
                  controlSize('large'),
                  ...(isPrimary && !highContrast ? [tint(ACCENT_FILL)] : []),
                  ...(highContrast
                    ? [
                        frame({ width: 48, height: 48 }),
                        foregroundStyle(isPrimary ? ON_ACCENT_FILL : colors.text),
                        background(isPrimary ? ACCENT_FILL : colors.background, shapes.circle()),
                      ]
                    : []),
                ]}
              />
            );
          })}
        </VStack>
      </GlassEffectContainer>
    </Host>
  );
}
