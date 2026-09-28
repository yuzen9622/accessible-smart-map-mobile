import {
  Button,
  DisclosureGroup,
  Form,
  Host,
  LabeledContent,
  Picker,
  Section,
  Text,
  Toggle,
} from '@expo/ui/swift-ui';
import { buttonStyle, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';

import { TRAVEL_MODES, type SheetSpikePanelProps, type TravelMode } from './SheetSpikePanel.types';

export default function SheetSpikePanel({ onOpenDetail }: SheetSpikePanelProps) {
  const [mode, setMode] = useState<TravelMode>('transit');
  const [expanded, setExpanded] = useState(false);
  const [avoidStairs, setAvoidStairs] = useState(true);
  return (
    <Host style={{ flex: 1 }}>
      <Form>
        <Section title="起訖點">
          <LabeledContent label="起點">
            <Text>目前位置</Text>
          </LabeledContent>
          <LabeledContent label="終點">
            <Text>台北 101</Text>
          </LabeledContent>
        </Section>
        <Section>
          <Picker
            label="交通方式"
            selection={mode}
            onSelectionChange={setMode}
            modifiers={[pickerStyle('segmented')]}>
            {TRAVEL_MODES.map((item) => (
              <Text key={item.value} modifiers={[tag(item.value)]}>
                {item.label}
              </Text>
            ))}
          </Picker>
          <DisclosureGroup label="無障礙偏好" isExpanded={expanded} onIsExpandedChange={setExpanded}>
            <Toggle label="避開樓梯" isOn={avoidStairs} onIsOnChange={setAvoidStairs} />
          </DisclosureGroup>
        </Section>
        <Section>
          <Button label="查看路線詳情" systemImage="arrow.right" onPress={onOpenDetail} />
          <Button
            label="開始導航"
            systemImage="location.fill"
            modifiers={[buttonStyle('glassProminent')]}
          />
        </Section>
      </Form>
    </Host>
  );
}
