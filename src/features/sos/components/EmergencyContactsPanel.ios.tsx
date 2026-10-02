import { Button, Form, HStack, LabeledContent, ProgressView, Section, Spacer, Text, TextField, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, font, foregroundStyle, onSubmit, submitLabel, textContentType } from '@expo/ui/swift-ui/modifiers';

import { useAppTranslation } from '@/shared/i18n';
import { FormPrimaryButton, KeyboardAvoidingHost } from '@/shared/ui';

import type { EmergencyContactsPanelProps } from './EmergencyContactsPanel.types';

const secondary = [font({ textStyle: 'footnote' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })];

export default function EmergencyContactsPanel({ model }: EmergencyContactsPanelProps) {
  const { t } = useAppTranslation();
  return (
    <KeyboardAvoidingHost>
      <Form>
        <Section title={model.title} footer={<Text>{model.description}</Text>}>
          {model.loading && model.contacts.length === 0 ? <ProgressView /> : null}
          {!model.loading && model.contacts.length === 0 ? <Text modifiers={secondary}>{t('sosContactsEmpty')}</Text> : null}
          {model.contacts.map((contact) => (
            <HStack key={contact.id}>
              <VStack alignment="leading">
                <Text>{contact.name}</Text>
                <Text modifiers={secondary}>{contact.statusText}</Text>
              </VStack>
              <Spacer />
              <Button label={t('sosContactsDelete')} role="destructive" onPress={contact.onDelete} modifiers={[buttonStyle('borderless')]} />
            </HStack>
          ))}
          {model.error ? <Button label={t('retry')} onPress={model.retry} /> : null}
        </Section>

        {model.bindResult ? (
          <Section title={t('sosContactsBindResultTitle')} footer={<Text>{t('sosContactsBindExpiry')}</Text>}>
            <LabeledContent label={t('sosContactsBindCodeLabel')}>
              <Text modifiers={[font({ textStyle: 'title3', design: 'monospaced' })]}>{model.bindResult.code}</Text>
            </LabeledContent>
            <Button label={t('nativeCopyBindCode')} onPress={model.bindResult.copyCode} />
            <Button label={t('sosContactsBindUrlLabel')} onPress={model.bindResult.openUrl} />
            <Button label={t('nativeCopyBindUrl')} onPress={model.bindResult.copyUrl} />
            <Button label={t('done')} onPress={model.bindResult.dismiss} />
          </Section>
        ) : null}

        <Section footer={<Text>{model.atLimit ? model.limitText : t('nativeContactAddHint')}</Text>}>
          <TextField
            placeholder={t('sosContactsAddPlaceholder')}
            onTextChange={model.setName}
            maxLength={50}
            modifiers={[textContentType('name'), submitLabel('done'), onSubmit(model.add), disabled(model.atLimit || model.submitting)]}
          />
        </Section>
        <Section>
          <FormPrimaryButton
            label={t('sosContactsAddSubmit')}
            onPress={model.add}
            disabled={model.atLimit || !model.name.trim()}
            loading={model.submitting}
          />
        </Section>
      </Form>
    </KeyboardAvoidingHost>
  );
}
