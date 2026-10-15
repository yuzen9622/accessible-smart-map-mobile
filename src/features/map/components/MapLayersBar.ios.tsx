import Host from '@/shared/ui/typography/PreferenceHost.ios';
import { Button, GlassEffectContainer, HStack } from '@expo/ui/swift-ui';
import { background, buttonStyle, controlSize, dynamicTypeSize, foregroundStyle, frame, labelStyle, shapes } from '@expo/ui/swift-ui/modifiers';

import { useAppTranslation } from '@/shared/i18n';
import { usePreferencesStore } from '@/shared/preferences/preferencesStore';
import { useThemeColors, useSemanticColors } from '@/shared/theme';

import type { MapLayersBarProps } from './MapLayersBar.types';

/** 常駐橫向圖層捷徑列，iOS 用 Liquid Glass：相鄰按鈕由 GlassEffectContainer 融合，選取中反白。 */
export default function MapLayersBar({ is3d, onToggle3d, facilityToggles }: MapLayersBarProps) {
  const { t } = useAppTranslation();
  const highContrast = usePreferencesStore((s) => s.highContrast);
  const colors = useThemeColors();
  const tones = useSemanticColors();

  const items = [
    { key: '3d', label: t('switchTo3D'), systemImage: 'cube' as const, selected: is3d, onToggle: onToggle3d },
    ...facilityToggles,
  ];

  return (
    <Host matchContents modifiers={[dynamicTypeSize({ max: 'xxxLarge' })]}>
      <GlassEffectContainer spacing={4}>
        <HStack spacing={4}>
          {items.map((item) => (
            <Button
              key={item.key}
              label={item.label}
              systemImage={item.systemImage}
              onPress={item.onToggle}
              modifiers={[
                labelStyle('iconOnly'),
                buttonStyle(highContrast ? 'plain' : 'glass'),
                controlSize('large'),
                ...(item.selected
                  ? [foregroundStyle(tones.accent), background(tones.accentSoft, shapes.circle())]
                  : highContrast
                    ? [frame({ width: 44, height: 44 }), foregroundStyle(colors.text), background(colors.background, shapes.circle())]
                    : []),
              ]}
            />
          ))}
        </HStack>
      </GlassEffectContainer>
    </Host>
  );
}
