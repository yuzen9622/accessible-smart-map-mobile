import { DisclosureGroup, Host, Label, List, Section, Text } from '@expo/ui/swift-ui';

import { SPIKE_LEGS, type SheetSpikeDetailProps } from './SheetSpikeDetail.types';

export default function SheetSpikeDetail({ legs = SPIKE_LEGS }: SheetSpikeDetailProps) {
  return (
    <Host style={{ flex: 1 }}>
      <List>
        {legs.map((leg) => (
          <Section key={leg.key} title={leg.mode}>
            <Label title={leg.summary} systemImage={leg.stops.length > 0 ? 'tram.fill' : 'figure.roll'} />
            {leg.stops.length > 0 ? (
              <DisclosureGroup label={`經過 ${leg.stops.length} 站`}>
                {leg.stops.map((stop) => (
                  <Text key={stop}>{stop}</Text>
                ))}
              </DisclosureGroup>
            ) : null}
          </Section>
        ))}
      </List>
    </Host>
  );
}
