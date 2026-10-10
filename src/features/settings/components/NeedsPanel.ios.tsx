import Host from '@/shared/ui/typography/PreferenceHost.ios';
import { Text, Toggle } from '@expo/ui/swift-ui';
import { Form, Section } from '@/shared/ui/form/PreferenceForm.ios';

import type { NeedsPanelProps } from './NeedsPanel.types';

export default function NeedsPanel({ model }: NeedsPanelProps) {
  return (
    <Host style={{ flex: 1 }}>
      <Form>
        {/* 推導出的路線模式接在說明下方（同一個 footer），不再自己一張只有一行灰字的白卡 */}
        <Section
          title={model.title}
          footer={<Text>{model.derivedModeText ? `${model.hint}\n${model.derivedModeText}` : model.hint}</Text>}>
          {model.options.map((option) => (
            <Toggle key={option.id} isOn={option.selected} onIsOnChange={option.onToggle}>
              <Text>{option.label}</Text>
              <Text>{option.description}</Text>
            </Toggle>
          ))}
        </Section>
      </Form>
    </Host>
  );
}
