import { useAppTranslation } from '@/shared/i18n';
import { FormButton, FormRow, FormScreen, FormSection, FormSegmented, FormSwitch, FormText } from '@/shared/ui';

import type { SettingsPanelProps } from './SettingsPanel.types';

export default function SettingsPanel({ model }: SettingsPanelProps) {
  const { t } = useAppTranslation();
  return (
    <FormScreen>
      <FormSection title={t('nativeSettingsAccount')}>
        {model.account ? (
          <>
            <FormRow label={model.account.name} value={model.account.email} />
            <FormRow
              label={model.account.hasPassword ? t('nativeSecurityChangeTitle') : t('nativeSecurityAddTitle')}
              onPress={model.openSecurity}
            />
            <FormRow label={model.account.lineLinked ? t('nativeLineLinked') : t('nativeLineTitle')} onPress={model.openLine} />
            <FormRow label={t('logout')} destructive onPress={model.logout} />
            {model.deleteAccount ? <FormRow label={t('nativeDeleteAccountTitle')} destructive onPress={model.deleteAccount} /> : null}
          </>
        ) : (
          <>
            <FormText tone="secondary">{t('nativeSettingsLoginHint')}</FormText>
            <FormButton label={t('loginRegisterCta')} onPress={model.openLogin} />
          </>
        )}
      </FormSection>

      <FormSection title={t('settingsAppearanceTitle')} footer={t('settingsHighContrastLocalHint')}>
        <FormText tone="secondary">{t('darkMode')}</FormText>
        <FormSegmented label={t('darkMode')} value={model.themeMode} choices={model.themeChoices} onChange={model.setThemeMode} />
        <FormText tone="secondary">{t('fontSize')}</FormText>
        <FormSegmented label={t('fontSize')} value={model.fontSize} choices={model.fontChoices} onChange={model.setFontSize} />
        <FormText tone="secondary">{t('language')}</FormText>
        <FormSegmented label={t('language')} value={model.language} choices={model.languageChoices} onChange={model.setLanguage} />
        <FormSwitch label={t('highContrast')} value={model.highContrast} onValueChange={model.setHighContrast} />
      </FormSection>

      <FormSection title={t('nativeSettingsNeeds')} footer={t('nativeSettingsNeedsHint')}>
        <FormRow label={t('nativeSettingsEditNeeds')} value={model.needsSummary} onPress={model.openNeeds} />
      </FormSection>

      <FormSection title={t('settingsEmergencyTitle')} footer={t('settingsEmergencyDesc')}>
        <FormRow label={t('sosContactsManageTitle')} onPress={model.openContacts} />
      </FormSection>

      <FormSection title={t('notification')} footer={t('nativePushDescription')}>
        <FormSwitch label={t('notification')} value={model.notifications} onValueChange={model.setNotifications} />
        <FormText tone="secondary">{model.notificationStatusText}</FormText>
        {model.notificationAction ? <FormButton label={model.notificationActionLabel} onPress={model.notificationAction} /> : null}
      </FormSection>

      <FormSection title={t('nativeSettingsReports')}>
        <FormRow label={t('nativeMyReports')} onPress={model.openReports} />
      </FormSection>

      <FormSection title={t('aiMemoryTitle')} footer={t('aiMemoryDesc')}>
        <FormRow label={t('aiMemoryTitle')} value={model.memoryEnabled ? t('aiMemoryEnabled') : t('aiMemoryDisabled')} onPress={model.openMemory} />
      </FormSection>

      <FormSection title={t('settingsDataTitle')}>
        <FormRow label={t('settingsDataTitle')} onPress={model.openData} />
        <FormRow label={t('resetGuides')} onPress={model.resetGuides} />
      </FormSection>

      <FormSection>
        {model.legalLinks.map((link) => (
          <FormRow key={link.key} label={link.label} onPress={link.open} />
        ))}
        <FormRow label={t('nativeAppVersion')} value={model.version} />
      </FormSection>
    </FormScreen>
  );
}
