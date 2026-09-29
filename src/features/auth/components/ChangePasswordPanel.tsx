import { useAppTranslation } from '@/shared/i18n';
import { FormButton, FormInput, FormScreen, FormSection, FormText } from '@/shared/ui';

import type { ChangePasswordPanelProps } from './ChangePasswordPanel.types';

export default function ChangePasswordPanel({ model }: ChangePasswordPanelProps) {
  const { t } = useAppTranslation();
  return (
    <FormScreen>
      <FormSection title={model.title} footer={model.description}>
        {model.hasPassword ? (
          <FormInput
            label={t('nativeSecurityCurrent')}
            value={model.currentPassword}
            onChangeText={model.setCurrentPassword}
            secure
            autoComplete="current-password"
          />
        ) : null}
        <FormInput
          label={t('auth.newPassword')}
          value={model.newPassword}
          onChangeText={model.setNewPassword}
          secure
          autoComplete="new-password"
          onSubmitEditing={model.submit}
        />
        {model.error ? <FormText tone="error">{model.error}</FormText> : null}
        <FormButton label={model.submitLabel} loading={model.loading} onPress={model.submit} />
      </FormSection>
    </FormScreen>
  );
}
