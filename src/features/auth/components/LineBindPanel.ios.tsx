import Host from '@/shared/ui/typography/PreferenceHost.ios';
import { LabeledContent, Text } from '@expo/ui/swift-ui';
import { Button, Form, Section } from '@/shared/ui/form/PreferenceForm.ios';
import { font } from '@expo/ui/swift-ui/modifiers';

import { useAppTranslation } from '@/shared/i18n';
import { FormPrimaryButton } from '@/shared/ui';

import type { LineBindPanelProps } from './LineBindPanel.types';

export default function LineBindPanel({ model }: LineBindPanelProps) {
  const { t } = useAppTranslation();
  return (
    <Host style={{ flex: 1 }}>
      <Form>
        {/* 已產生綁定碼時，時效說明跟著綁定碼那一段；還沒產生時跟著「立即綁定」按鈕 */}
        <Section title={t('nativeLineTitle')} footer={model.code ? <Text>{t('nativeLineExpiry')}</Text> : undefined}>
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
          ) : null}
        </Section>
        {model.code ? null : (
          <Section footer={<Text>{t('nativeLineExpiry')}</Text>}>
            <FormPrimaryButton label={t('nativeLineBindNow')} onPress={model.bind} loading={model.loading} />
          </Section>
        )}
      </Form>
    </Host>
  );
}
