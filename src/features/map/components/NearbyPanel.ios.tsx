import {
  Button,
  Form,
  HStack,
  Host,
  ProgressView,
  Section,
  Spacer,
  Text,
  Toggle,
  VStack,
} from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';

import type { NearbyPanelProps } from './NearbyPanel.types';

export default function NearbyPanel({ model, onRequestLocation, labels }: NearbyPanelProps) {
  return (
    <Host style={{ flex: 1 }}>
      <Form>
        <Section title={labels.filterHint}>
          {model.toggles.map((toggle) => (
            <Toggle key={toggle.category} label={toggle.label} isOn={toggle.isOn} onIsOnChange={toggle.onToggle} />
          ))}
        </Section>
        <Section title={labels.nearbyTitle}>
          {model.status === 'loading' ? <ProgressView /> : null}
          {model.status === 'error' ? <Text>{model.errorMessage ?? labels.empty}</Text> : null}
          {model.status === 'empty' ? <Text>{labels.empty}</Text> : null}
          {model.status === 'no-location' ? (
            <Button label={labels.locate} systemImage="location.fill" onPress={onRequestLocation} />
          ) : null}
          {model.rows.map((row) => (
            <Button
              key={row.key}
              onPress={row.onPress}
              // plain：列表列以一般文字色呈現（不是藍色連結），整列仍可點
              modifiers={[buttonStyle('plain'), accessibilityLabel(row.accessibilityLabel)]}>
              <HStack>
                <VStack alignment="leading" spacing={2}>
                  <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>{row.title}</Text>
                  <Text
                    modifiers={[
                      font({ textStyle: 'footnote' }),
                      foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                    ]}>
                    {row.subtitle}
                  </Text>
                </VStack>
                <Spacer />
                <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
                  {row.distanceText}
                </Text>
              </HStack>
            </Button>
          ))}
        </Section>
      </Form>
    </Host>
  );
}
