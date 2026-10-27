import { Button, Label, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, contentShape, font, foregroundStyle, frame, labelStyle, shapes } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet } from 'react-native';

import { ICON_SIZE, SHAPE, useThemeColors } from '@/shared/theme';
import GlassCard from '@/shared/ui/GlassCard';
import Host from '@/shared/ui/typography/PreferenceHost.ios';

import type { MapControlsProps } from './MapControls.types';

/** 共用一個玻璃膠囊；每個動作保留獨立的 48pt 觸控區域。 */
export default function MapControls({ actions }: MapControlsProps) {
  const colors = useThemeColors();
  return (
    <GlassCard style={styles.capsule}>
      <Host matchContents>
        <VStack spacing={0}>
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
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  capsule: { borderRadius: SHAPE.pill },
});
