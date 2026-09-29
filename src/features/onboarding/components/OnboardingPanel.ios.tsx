import { Button, Form, Host, HStack, Section, Spacer, Text, Toggle } from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';

import { FormPrimaryButton, FormSecondaryButton } from '@/shared/ui';

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
          <>
            <Section>
              <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{model.intro.title}</Text>
              <Text modifiers={[font({ textStyle: 'body' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
                {model.intro.body}
              </Text>
            </Section>
            <Section>
              <FormPrimaryButton label={model.intro.startLabel} onPress={model.intro.onStart} />
            </Section>
          </>
        ) : null}

        {model.stepId === 'needs' ? (
          <>
            {/* 說明固定留在需求那一段；推導出的路線模式另起一列，勾選時文字不會在兩段之間跳位置 */}
            <Section title={model.needs.title} footer={<Text>{model.needs.hint}</Text>}>
              {model.needs.options.map((option) => (
                // 兩個 Text 子元素＝主標題＋副標題（SwiftUI Toggle 原生的兩行標籤），取代「A — B」一行擠在一起
                <Toggle key={option.id} isOn={option.selected} onIsOnChange={() => model.needs.onToggle(option.id)}>
                  <Text>{option.label}</Text>
                  <Text>{option.description}</Text>
                </Toggle>
              ))}
            </Section>
            {model.needs.derivedModeText ? (
              <Section>
                <Text modifiers={secondaryText}>{model.needs.derivedModeText}</Text>
              </Section>
            ) : null}
            <Section>
              <FormPrimaryButton label={model.needs.nextLabel} onPress={model.needs.onNext} />
            </Section>
          </>
        ) : null}

        {model.stepId === 'location' ? (
          <>
            <Section title={model.location.title} footer={<Text>{model.location.privacy}</Text>}>
              {model.location.benefits.map((benefit) => (
                <Text key={benefit}>{benefit}</Text>
              ))}
              {model.location.outcomeText ? <Text>{model.location.outcomeText}</Text> : null}
            </Section>
            <Section>
              {model.location.state === 'granted' ||
              model.location.state === 'denied' ||
              model.location.state === 'unsupported' ? (
                <FormPrimaryButton label={model.location.nextLabel} onPress={model.location.onNext} />
              ) : (
                // 請求定位中兩顆按鈕都留著（次要的先停用），整段高度不變，版面不跳
                <>
                  <FormPrimaryButton
                    label={model.location.allowLabel}
                    onPress={model.location.onRequest}
                    loading={model.location.state === 'requesting'}
                  />
                  <FormSecondaryButton
                    label={model.location.manualLabel}
                    onPress={model.location.onNext}
                    disabled={model.location.state === 'requesting'}
                  />
                </>
              )}
            </Section>
          </>
        ) : null}

        {model.stepId === 'done' ? (
          <>
            <Section>
              <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>{model.done.title}</Text>
            </Section>
            <Section>
              <FormPrimaryButton label={model.done.startLabel} onPress={model.done.onStart} />
              <FormSecondaryButton label={model.done.tryToiletLabel} onPress={model.done.onTryToilet} />
            </Section>
          </>
        ) : null}
      </Form>
    </Host>
  );
}
