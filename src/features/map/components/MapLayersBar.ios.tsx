import Host from '@/shared/ui/typography/PreferenceHost.ios';
import { Button, GlassEffectContainer, HStack, VStack } from '@expo/ui/swift-ui';
import { background, buttonStyle, controlSize, dynamicTypeSize, foregroundStyle, frame, shapes } from '@expo/ui/swift-ui/modifiers';

import { usePreferencesStore } from '@/shared/preferences/preferencesStore';
import { useThemeColors, useSemanticColors } from '@/shared/theme';

import type { MapLayersBarProps } from './MapLayersBar.types';

/** 一排最多放幾顆：帶文字標籤的按鈕比純圖示寬很多，4 顆排成一列會超出畫面右緣
 * （使用者回饋截圖實測：「...」「坡道」「廁所」「停車」最左邊那顆被切掉）；2 顆一列時
 * 同列按鈕會互相擠壓寬度，長一點的標籤（「電梯」配的 SF Symbol 本身較寬）被截斷成「...」，
 * 改成 1 顆一列，每顆各自有完整寬度可以撐開文字。 */
const ITEMS_PER_ROW = 1;

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

/** 常駐橫向圖層捷徑列，iOS 用 Liquid Glass：相鄰按鈕由 GlassEffectContainer 融合，選取中反白。
 * 帶文字標籤（不是 `labelStyle('iconOnly')`）——純圖示時使用者分不出每顆在篩什麼類別
 * （使用者回饋）；2D／3D 已搬到 `MapControls` 自己的常駐按鈕，這排只剩設施篩選。
 * 兩顆一列排成格狀，不是單一橫排——四顆帶標籤的按鈕排一列會超出畫面寬度。 */
export default function MapLayersBar({ facilityToggles }: MapLayersBarProps) {
  const highContrast = usePreferencesStore((s) => s.highContrast);
  const colors = useThemeColors();
  const tones = useSemanticColors();

  return (
    <Host matchContents modifiers={[dynamicTypeSize({ max: 'xxxLarge' })]}>
      <GlassEffectContainer spacing={4}>
        <VStack spacing={4}>
          {chunk(facilityToggles, ITEMS_PER_ROW).map((row, index) => (
            <HStack key={index} spacing={4}>
              {row.map((item) => (
                <Button
                  key={item.key}
                  label={item.label}
                  systemImage={item.systemImage}
                  onPress={item.onToggle}
                  modifiers={[
                    buttonStyle(highContrast ? 'plain' : 'glass'),
                    controlSize('large'),
                    ...(item.selected
                      ? [foregroundStyle(tones.accent), background(tones.accentSoft, shapes.capsule())]
                      : highContrast
                        ? [frame({ height: 44 }), foregroundStyle(colors.text), background(colors.background, shapes.capsule())]
                        : []),
                  ]}
                />
              ))}
            </HStack>
          ))}
        </VStack>
      </GlassEffectContainer>
    </Host>
  );
}
