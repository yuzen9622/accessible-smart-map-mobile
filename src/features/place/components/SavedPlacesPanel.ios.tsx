import Host from '@/shared/ui/typography/PreferenceHost.ios';
import { HStack, Spacer, SwipeActions, Text, VStack } from '@expo/ui/swift-ui';
import { Button, Form, Section, useSecondaryForeground } from '@/shared/ui/form/PreferenceForm.ios';
import { accessibilityLabel, buttonStyle, foregroundStyle } from '@expo/ui/swift-ui/modifiers';

import type { SavedPlacesPanelProps } from './SavedPlacesPanel.types';

export default function SavedPlacesPanel({ model }: SavedPlacesPanelProps) {
  const secondaryForeground = useSecondaryForeground();
  if (model.status === 'empty') {
    return (
      <Host style={{ flex: 1 }}>
        <Form>
          <Section>
            <Text>{model.emptyTitle}</Text>
            <Text modifiers={[secondaryForeground]}>{model.emptyDescription}</Text>
          </Section>
        </Form>
      </Host>
    );
  }

  return (
    <Host style={{ flex: 1 }}>
      <Form>
        <Section header={<Text>{model.countLabel}</Text>}>
          {model.filters.map((filter) => (
            <Button key={filter.value} onPress={filter.onSelect} modifiers={[buttonStyle('plain')]}>
              <HStack>
                <Text>{filter.label}</Text>
                <Spacer />
                {filter.isSelected ? (
                  <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>{'✓'}</Text>
                ) : null}
              </HStack>
            </Button>
          ))}
        </Section>

        <Section>
          {model.rows.map((row) => (
            // SwipeActions 左滑刪除：本次時間盒內未在模擬器上實測，行為以 SwiftUI 官方語意為準（見 port-ledger）。
            <SwipeActions key={row.key}>
              <Button
                onPress={row.onPress}
                modifiers={[
                  buttonStyle('plain'),
                  accessibilityLabel(row.categoryLabel ? `${row.title}，${row.categoryLabel}` : row.title),
                ]}>
                <VStack alignment="leading" spacing={2}>
                  <Text>{row.title}</Text>
                  {row.categoryLabel ? (
                    <Text modifiers={[secondaryForeground]}>{row.categoryLabel}</Text>
                  ) : null}
                </VStack>
              </Button>
              <SwipeActions.Actions edge="trailing">
                <Button
                  role="destructive"
                  label={model.unsaveLabel}
                  onPress={row.onRemove}
                  modifiers={[accessibilityLabel(row.removeAccessibilityLabel)]}
                />
              </SwipeActions.Actions>
            </SwipeActions>
          ))}
        </Section>
      </Form>
    </Host>
  );
}
