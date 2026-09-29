import { Button, Form, Host, LabeledContent, ProgressView, Section, Text } from '@expo/ui/swift-ui';
import { buttonStyle, font } from '@expo/ui/swift-ui/modifiers';

import { useAppTranslation } from '@/shared/i18n';

import type { LineBindPanelProps } from './LineBindPanel.types';

export default function LineBindPanel({ model }: LineBindPanelProps) {
  const { t } = useAppTranslation();
  return (
    <Host style={{ flex: 1 }}>
      <Form>
        <Section title={t('nativeLineTitle')} footer={<Text>{t('nativeLineExpiry')}</Text>}>
          <Text>{model.linked ? t('nativeLineAlreadyLinked') : t('nativeLineDesc')}</Text>
          {model.code ? (
            <>
              <Text>{t('nativeLineSendCode')}</Text>
              <LabeledContent label={t('sosContactsBindCodeLabel')}>
                <Text modifiers={[font({ textStyle: 'title2', design: 'monospaced' })]}>{model.code}</Text>
              </LabeledContent>
              <Button label={t('copyLink')} onPress={model.copy} />
              <Button label={t('nativeLineReopen')} onPress={model.reopen} />
            </>
          ) : model.loading ? (
            <ProgressView />
          ) : (
            <Button label={t('nativeLineBindNow')} onPress={model.bind} modifiers={[buttonStyle('borderedProminent')]} />
          )}
        </Section>
      </Form>
    </Host>
  );
}
