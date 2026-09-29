import { useAppTranslation } from '@/shared/i18n';
import { FormButton, FormInput, FormScreen, FormSection, FormSegmented, FormText } from '@/shared/ui';

import type { AuthPanelProps } from './AuthPanel.types';

/** Android／fallback：RN 表單（見 `shared/ui/form`）。Apple 登入只在 iOS 提供。 */
export default function AuthPanel({ model }: AuthPanelProps) {
  const { t } = useAppTranslation();

  if (model.registered) {
    return (
      <FormScreen>
        <FormSection title={t('auth.registerSuccessTitle')}>
          <FormText>
            {model.registered.emailSent ? t('auth.registerSuccessBody', { email: model.email }) : t('auth.registerNoEmailBody')}
          </FormText>
          {model.registered.inboxUrl ? <FormButton label={t('auth.openInbox')} onPress={model.openInbox} /> : null}
          <FormButton label={t('auth.resend')} variant="secondary" onPress={model.resendVerification} />
          <FormButton label={t('auth.goToLogin')} variant="secondary" onPress={() => model.setMode('login')} />
        </FormSection>
      </FormScreen>
    );
  }

  if (model.forgotSent) {
    return (
      <FormScreen>
        <FormSection title={t('auth.resetPassword')} footer={t('nativeAuthResetOnWeb')}>
          <FormText>{t('auth.forgotSentBody')}</FormText>
          <FormButton label={t('auth.backToLogin')} variant="secondary" onPress={() => model.setMode('login')} />
        </FormSection>
      </FormScreen>
    );
  }

  const title =
    model.mode === 'register' ? t('auth.createAccount') : model.mode === 'forgot' ? t('auth.resetPassword') : t('auth.welcomeBack');
  const submitLabel =
    model.mode === 'register' ? t('auth.register') : model.mode === 'forgot' ? t('auth.forgotSendButton') : t('auth.login');

  return (
    <FormScreen>
      {model.mode !== 'forgot' ? (
        <FormSection>
          <FormSegmented
            label={title}
            value={model.mode}
            choices={[
              { value: 'login', label: t('auth.login') },
              { value: 'register', label: t('auth.register') },
            ]}
            onChange={model.setMode}
          />
          {model.showGoogle ? (
            <FormButton label={t('nativeAuthContinueWithGoogle')} variant="secondary" disabled={model.loading} onPress={model.signInWithGoogle} />
          ) : null}
        </FormSection>
      ) : null}

      <FormSection title={title} footer={model.mode === 'forgot' ? t('nativeAuthForgotHint') : t('auth.guestPath')}>
        {model.mode === 'register' ? (
          <FormInput label={t('auth.nickname')} value={model.name} onChangeText={model.setName} autoComplete="nickname" maxLength={60} />
        ) : null}
        <FormInput
          label={t('auth.email')}
          value={model.email}
          onChangeText={model.setEmail}
          keyboardType="email-address"
          autoComplete="email"
          onSubmitEditing={model.mode === 'forgot' ? model.submit : undefined}
        />
        {model.mode !== 'forgot' ? (
          <FormInput
            label={t('auth.password')}
            value={model.password}
            onChangeText={model.setPassword}
            secure
            autoComplete={model.mode === 'register' ? 'new-password' : 'current-password'}
            onSubmitEditing={model.submit}
          />
        ) : null}
        {model.passwordHint ? <FormText tone="secondary">{model.passwordHint}</FormText> : null}
        {model.error ? <FormText tone="error">{model.error}</FormText> : null}
        <FormButton label={submitLabel} loading={model.loading} onPress={model.submit} />
        {model.needsVerification ? (
          <FormButton label={t('auth.resendVerification')} variant="secondary" onPress={model.resendVerification} />
        ) : null}
        {model.mode === 'login' ? (
          <FormButton label={t('auth.forgotPassword')} variant="secondary" onPress={() => model.setMode('forgot')} />
        ) : null}
        {model.mode === 'forgot' ? (
          <FormButton label={t('auth.backToLogin')} variant="secondary" onPress={() => model.setMode('login')} />
        ) : null}
      </FormSection>
    </FormScreen>
  );
}
