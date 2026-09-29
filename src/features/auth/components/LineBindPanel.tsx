import { useAppTranslation } from '@/shared/i18n';
import { FormButton, FormRow, FormScreen, FormSection, FormText } from '@/shared/ui';

import type { LineBindPanelProps } from './LineBindPanel.types';

export default function LineBindPanel({ model }: LineBindPanelProps) {
  const { t } = useAppTranslation();
  return (
    <FormScreen>
      <FormSection title={t('nativeLineTitle')} footer={t('nativeLineExpiry')}>
        <FormText>{model.linked ? t('nativeLineAlreadyLinked') : t('nativeLineDesc')}</FormText>
        {model.code ? (
          <>
            <FormText tone="secondary">{t('nativeLineSendCode')}</FormText>
            <FormRow label={t('sosContactsBindCodeLabel')} value={model.code} />
            <FormButton label={t('copyLink')} variant="secondary" onPress={model.copy} />
            <FormButton label={t('nativeLineReopen')} variant="secondary" onPress={model.reopen} />
          </>
        ) : (
          <FormButton label={t('nativeLineBindNow')} loading={model.loading} onPress={model.bind} />
        )}
      </FormSection>
    </FormScreen>
  );
}
