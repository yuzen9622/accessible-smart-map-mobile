import { Button, Form, Host, LabeledContent, Section, Text } from '@expo/ui/swift-ui';
import { font } from '@expo/ui/swift-ui/modifiers';

import type { FacilityDetailPanelProps } from './FacilityDetailPanel.types';

export default function FacilityDetailPanel({ title, rows, showOnMapLabel, onShowOnMap }: FacilityDetailPanelProps) {
  return (
    <Host style={{ flex: 1 }}>
      <Form>
        <Section>
          <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{title}</Text>
          {rows.map((row) => (
            <LabeledContent key={row.label} label={row.label}>
              <Text>{row.value}</Text>
            </LabeledContent>
          ))}
        </Section>
        <Section>
          <Button label={showOnMapLabel} systemImage="map" onPress={onShowOnMap} />
        </Section>
      </Form>
    </Host>
  );
}
