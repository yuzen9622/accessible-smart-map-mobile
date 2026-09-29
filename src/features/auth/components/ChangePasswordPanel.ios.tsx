import { Button, Form, Host, ProgressView, SecureField, Section, Text } from '@expo/ui/swift-ui';
import { buttonStyle, font, foregroundStyle, onSubmit, submitLabel, textContentType } from '@expo/ui/swift-ui/modifiers';

import { useAppTranslation } from '@/shared/i18n';

import type { ChangePasswordPanelProps } from './ChangePasswordPanel.types';

export default function ChangePasswordPanel({ model }: ChangePasswordPanelProps) {
  const { t } = useAppTranslation();
  return (
    <Host style={{ flex: 1 }}>
      <Form>
        <Section title={model.title} footer={<Text>{model.description}</Text>}>
          {model.hasPassword ? (
            <SecureField
              placeholder={t('nativeSecurityCurrent')}
              onTextChange={model.setCurrentPassword}
              modifiers={[textContentType('password'), submitLabel('next')]}
            />
          ) : null}
          <SecureField
            placeholder={t('auth.newPassword')}
            onTextChange={model.setNewPassword}
            modifiers={[textContentType('newPassword'), submitLabel('done'), onSubmit(model.submit)]}
          />
          {model.error ? <Text modifiers={[font({ textStyle: 'footnote' }), foregroundStyle('red')]}>{model.error}</Text> : null}
          {model.loading ? (
            <ProgressView />
          ) : (
            <Button label={model.submitLabel} onPress={model.submit} modifiers={[buttonStyle('borderedProminent')]} />
          )}
        </Section>
      </Form>
    </Host>
  );
}
