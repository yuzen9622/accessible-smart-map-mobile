import {
  Button,
  Form,
  Host,
  Picker,
  RNHostView,
  SecureField,
  Section,
  Text,
  TextField,
} from '@expo/ui/swift-ui';
import {
  autocorrectionDisabled,
  bold,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  font,
  foregroundStyle,
  frame,
  keyboardType,
  onSubmit,
  pickerStyle,
  submitLabel,
  tag,
  textContentType,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers';
import { View, useWindowDimensions } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { FormPrimaryButton, FormSecondaryButton } from '@/shared/ui';

import AppleSignInButton from './AppleSignInButton';
import type { AuthPanelProps } from './AuthPanel.types';

const secondary = [font({ textStyle: 'footnote' }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })];
const errorStyle = [font({ textStyle: 'footnote' }), foregroundStyle('red')];

/** iOS：SwiftUI Form（系統輸入框、自動填入密碼、Dynamic Type）。Apple 官方按鈕以 RNHostView 嵌入。 */
export default function AuthPanel({ model }: AuthPanelProps) {
  const { t } = useAppTranslation();
  // RNHostView matchContents 以子元件尺寸為準，百分比寬度會解析成 0：以視窗寬扣掉 Form 左右內距
  const { width } = useWindowDimensions();
  const title =
    model.mode === 'register' ? t('auth.createAccount') : model.mode === 'forgot' ? t('auth.resetPassword') : t('auth.welcomeBack');

  if (model.registered) {
    return (
      <Host style={{ flex: 1 }}>
        <Form>
          <Section title={t('auth.registerSuccessTitle')}>
            <Text>
              {model.registered.emailSent ? t('auth.registerSuccessBody', { email: model.email }) : t('auth.registerNoEmailBody')}
            </Text>
            {model.registered.inboxUrl ? <Button label={t('auth.openInbox')} onPress={model.openInbox} /> : null}
            <Button label={t('auth.resend')} onPress={model.resendVerification} />
            <Button label={t('auth.goToLogin')} onPress={() => model.setMode('login')} />
          </Section>
        </Form>
      </Host>
    );
  }

  if (model.forgotSent) {
    return (
      <Host style={{ flex: 1 }}>
        <Form>
          <Section title={t('auth.resetPassword')}>
            <Text>{t('auth.forgotSentBody')}</Text>
            <Text modifiers={secondary}>{t('nativeAuthResetOnWeb')}</Text>
            <Button label={t('auth.backToLogin')} onPress={() => model.setMode('login')} />
          </Section>
        </Form>
      </Host>
    );
  }

  const submitLabelText =
    model.mode === 'register' ? t('auth.register') : model.mode === 'forgot' ? t('auth.forgotSendButton') : t('auth.login');

  return (
    <Host style={{ flex: 1 }}>
      <Form>
        {model.mode !== 'forgot' ? (
          <Section>
            <Picker<string>
              selection={model.mode}
              onSelectionChange={(value) => model.setMode(value === 'register' ? 'register' : 'login')}
              modifiers={[pickerStyle('segmented')]}>
              <Text modifiers={[tag('login')]}>{t('auth.login')}</Text>
              <Text modifiers={[tag('register')]}>{t('auth.register')}</Text>
            </Picker>
          </Section>
        ) : null}

        {model.mode !== 'forgot' && (model.showApple || model.showGoogle) ? (
          <Section footer={<Text>{t('auth.orEmail')}</Text>}>
            {model.showApple ? (
              <RNHostView matchContents>
                <View style={{ width: width - 72, height: 48 }}>
                  <AppleSignInButton onPress={model.signInWithApple} disabled={model.loading} />
                </View>
              </RNHostView>
            ) : null}
            {model.showGoogle ? (
              // 與上面的 Apple 按鈕同寬、同高、同圓角（Apple 規範的 8pt）；以前是靠左的一顆小藥丸，像次要連結
              <Button
                onPress={model.signInWithGoogle}
                modifiers={[
                  buttonStyle('bordered'),
                  controlSize('large'),
                  buttonBorderShape('roundedRectangle', 8),
                  disabled(model.loading),
                ]}>
                <Text modifiers={[frame({ maxWidth: 10000 }), bold()]}>{t('nativeAuthContinueWithGoogle')}</Text>
              </Button>
            ) : null}
          </Section>
        ) : null}

        <Section title={title}>
          {model.mode === 'register' ? (
            <TextField
              placeholder={t('auth.nickname')}
              onTextChange={model.setName}
              maxLength={60}
              modifiers={[textContentType('nickname'), submitLabel('next')]}
            />
          ) : null}
          <TextField
            placeholder={t('auth.email')}
            onTextChange={model.setEmail}
            modifiers={[
              keyboardType('email-address'),
              textContentType(model.mode === 'register' ? 'emailAddress' : 'username'),
              textInputAutocapitalization('never'),
              autocorrectionDisabled(),
              submitLabel(model.mode === 'forgot' ? 'send' : 'next'),
              ...(model.mode === 'forgot' ? [onSubmit(model.submit)] : []),
            ]}
          />
          {model.mode !== 'forgot' ? (
            <SecureField
              placeholder={t('auth.password')}
              onTextChange={model.setPassword}
              modifiers={[
                textContentType(model.mode === 'register' ? 'newPassword' : 'password'),
                submitLabel('go'),
                onSubmit(model.submit),
              ]}
            />
          ) : null}
          {model.passwordHint ? <Text modifiers={secondary}>{model.passwordHint}</Text> : null}
          {model.error ? <Text modifiers={errorStyle}>{model.error}</Text> : null}
        </Section>

        {/* 主要動作獨立成一段：整列寬的膠囊按鈕，不和輸入框擠在同一張卡片裡 */}
        <Section footer={<Text>{model.mode === 'forgot' ? t('nativeAuthForgotHint') : t('auth.guestPath')}</Text>}>
          <FormPrimaryButton label={submitLabelText} onPress={model.submit} loading={model.loading} />
          {model.needsVerification ? (
            <FormSecondaryButton label={t('auth.resendVerification')} onPress={model.resendVerification} disabled={model.loading} />
          ) : null}
        </Section>

        <Section>
          {model.mode === 'login' ? (
            <Button label={t('auth.forgotPassword')} onPress={() => model.setMode('forgot')} />
          ) : null}
          {model.mode === 'forgot' ? <Button label={t('auth.backToLogin')} onPress={() => model.setMode('login')} /> : null}
        </Section>
      </Form>
    </Host>
  );
}
