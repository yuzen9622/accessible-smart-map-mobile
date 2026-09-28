import { Button, Form, Host, HStack, ProgressView, Section, Spacer, Text, Toggle } from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';

import type { OnboardingPanelProps } from './OnboardingPanel.types';

const secondaryText = [
  font({ textStyle: 'footnote' }),
  foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
];

export default function OnboardingPanel({ model, backLabel, skipLabel }: OnboardingPanelProps) {
  return (
    <Host style={{ flex: 1 }}>
      <Form>
        <Section>
          <HStack>
            {model.canGoBack ? <Button label={backLabel} onPress={model.onBack} /> : null}
            <Spacer />
            <Text modifiers={secondaryText}>{model.progressText}</Text>
            <Spacer />
            <Button label={skipLabel} onPress={model.onSkip} />
          </HStack>
        </Section>

        {model.stepId === 'intro' ? (
          <Section title={model.intro.title}>
            <Text>{model.intro.body}</Text>
            <Button label={model.intro.startLabel} onPress={model.intro.onStart} />
          </Section>
        ) : null}

        {model.stepId === 'needs' ? (
          <Section title={model.needs.title} footer={<Text>{model.needs.hint}</Text>}>
            {model.needs.options.map((option) => (
              <Toggle
                key={option.id}
                label={`${option.label} — ${option.description}`}
                isOn={option.selected}
                onIsOnChange={() => model.needs.onToggle(option.id)}
              />
            ))}
            {model.needs.derivedModeText ? <Text modifiers={secondaryText}>{model.needs.derivedModeText}</Text> : null}
            <Button label={model.needs.nextLabel} onPress={model.needs.onNext} />
          </Section>
        ) : null}

        {model.stepId === 'location' ? (
          <Section title={model.location.title} footer={<Text>{model.location.privacy}</Text>}>
            {model.location.benefits.map((benefit) => (
              <Text key={benefit}>{benefit}</Text>
            ))}
            {model.location.outcomeText ? <Text>{model.location.outcomeText}</Text> : null}
            {model.location.state === 'granted' ||
            model.location.state === 'denied' ||
            model.location.state === 'unsupported' ? (
              <Button label={model.location.nextLabel} onPress={model.location.onNext} />
            ) : model.location.state === 'requesting' ? (
              <ProgressView />
            ) : (
              <>
                <Button label={model.location.allowLabel} onPress={model.location.onRequest} />
                <Button label={model.location.manualLabel} onPress={model.location.onNext} />
              </>
            )}
          </Section>
        ) : null}

        {model.stepId === 'done' ? (
          <Section title={model.done.title}>
            <Button label={model.done.tryToiletLabel} systemImage="figure.roll" onPress={model.done.onTryToilet} />
            <Button label={model.done.startLabel} onPress={model.done.onStart} />
          </Section>
        ) : null}
      </Form>
    </Host>
  );
}
