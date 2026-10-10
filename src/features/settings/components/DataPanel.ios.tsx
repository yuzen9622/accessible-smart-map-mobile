import Host from '@/shared/ui/typography/PreferenceHost.ios';
import { Button, Form, LabeledContent, Section, Text } from '@expo/ui/swift-ui';
import { disabled } from '@expo/ui/swift-ui/modifiers';

import type { DataPanelProps } from './DataPanel.types';

export default function DataPanel({ model }: DataPanelProps) {
  return (
    <Host style={{ flex: 1 }}>
      <Form>
        {model.rows.map((row) => (
          <Section key={row.key} title={row.title} footer={<Text>{row.description}</Text>}>
            <LabeledContent label={row.title}>
              <Text>{row.status}</Text>
            </LabeledContent>
            <Button label={row.actionLabel} role="destructive" onPress={row.onPress} modifiers={[disabled(row.disabled)]} />
          </Section>
        ))}
      </Form>
    </Host>
  );
}
