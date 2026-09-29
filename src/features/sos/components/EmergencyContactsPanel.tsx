import { useAppTranslation } from '@/shared/i18n';
import { FormButton, FormInput, FormRow, FormScreen, FormSection, FormText } from '@/shared/ui';

import type { EmergencyContactsPanelProps } from './EmergencyContactsPanel.types';

export default function EmergencyContactsPanel({ model }: EmergencyContactsPanelProps) {
  const { t } = useAppTranslation();
  return (
    <FormScreen>
      <FormSection title={model.title} footer={model.description}>
        {!model.loading && model.contacts.length === 0 ? <FormText tone="secondary">{t('sosContactsEmpty')}</FormText> : null}
        {model.contacts.map((contact) => (
          <FormRow key={contact.id} label={`${contact.name}（${contact.statusText}）`} value={t('sosContactsDelete')} destructive onPress={contact.onDelete} />
        ))}
        {model.error ? <FormButton label={t('retry')} variant="secondary" onPress={model.retry} /> : null}
      </FormSection>

      {model.bindResult ? (
        <FormSection title={t('sosContactsBindResultTitle')} footer={t('sosContactsBindExpiry')}>
          <FormRow label={t('sosContactsBindCodeLabel')} value={model.bindResult.code} />
          <FormButton label={t('nativeCopyBindCode')} variant="secondary" onPress={model.bindResult.copyCode} />
          <FormButton label={t('sosContactsBindUrlLabel')} variant="secondary" onPress={model.bindResult.openUrl} />
          <FormButton label={t('nativeCopyBindUrl')} variant="secondary" onPress={model.bindResult.copyUrl} />
          <FormButton label={t('done')} variant="secondary" onPress={model.bindResult.dismiss} />
        </FormSection>
      ) : null}

      <FormSection footer={model.atLimit ? model.limitText : t('nativeContactAddHint')}>
        <FormInput label={t('sosContactsAddPlaceholder')} value={model.name} onChangeText={model.setName} maxLength={50} onSubmitEditing={model.add} />
        <FormButton
          label={t('sosContactsAddSubmit')}
          loading={model.submitting}
          disabled={model.atLimit || !model.name.trim()}
          onPress={model.add}
        />
      </FormSection>
    </FormScreen>
  );
}
