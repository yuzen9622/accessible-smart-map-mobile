import { Form, Host, Section, Text, Toggle } from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';

import type { NeedsPanelProps } from './NeedsPanel.types';

export default function NeedsPanel({ model }: NeedsPanelProps) {
  return (
    <Host style={{ flex: 1 }}>
      <Form>
        <Section title={model.title} footer={<Text>{model.hint}</Text>}>
          {model.options.map((option) => (
            <Toggle key={option.id} isOn={option.selected} onIsOnChange={option.onToggle}>
              <Text>{option.label}</Text>
              <Text>{option.description}</Text>
            </Toggle>
          ))}
        </Section>
        <Section>
          <Text modifiers={[font({ textStyle: 'footnote' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
            {model.derivedModeText}
          </Text>
        </Section>
      </Form>
    </Host>
  );
}
