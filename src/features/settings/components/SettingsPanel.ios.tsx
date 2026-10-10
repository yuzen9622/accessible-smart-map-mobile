import Host from '@/shared/ui/typography/PreferenceHost.ios';
import { LabeledContent, Picker, Text, Toggle } from '@expo/ui/swift-ui';
import { Button, Form, Section, useSecondaryForeground } from '@/shared/ui/form/PreferenceForm.ios';
import { disabled, font, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import { useAppTranslation } from '@/shared/i18n';

import type { SettingsPanelProps } from './SettingsPanel.types';

/** iOS：SwiftUI Form（系統設定 App 的外觀與互動）。所有字串都包在 `Text` 內（見 memory：裸字串會閃退）。 */
export default function SettingsPanel({ model }: SettingsPanelProps) {
  const secondaryForeground = useSecondaryForeground();
  const secondary = [font({ textStyle: 'footnote' }), secondaryForeground];
  const { t } = useAppTranslation();
  return (
    <Host style={{ flex: 1 }}>
      <Form>
        <Section title={t('nativeSettingsAccount')}>
          {model.account ? (
            <>
              <LabeledContent label={model.account.name}>
                <Text modifiers={secondary}>{model.account.email}</Text>
              </LabeledContent>
              <Button
                label={model.account.hasPassword ? t('nativeSecurityChangeTitle') : t('nativeSecurityAddTitle')}
                onPress={model.openSecurity}
              />
              <Button label={model.account.lineLinked ? t('nativeLineLinked') : t('nativeLineTitle')} onPress={model.openLine} />
              <Button label={t('logout')} role="destructive" onPress={model.logout} />
              {model.deleteAccount ? (
                <Button label={t('nativeDeleteAccountTitle')} role="destructive" onPress={model.deleteAccount} />
              ) : null}
            </>
          ) : (
            <>
              <Text modifiers={secondary}>{t('nativeSettingsLoginHint')}</Text>
              <Button label={t('loginRegisterCta')} onPress={model.openLogin} />
            </>
          )}
        </Section>

        <Section title={t('settingsAppearanceTitle')} footer={<Text>{t('settingsHighContrastLocalHint')}</Text>}>
          <Picker<string>
            label={t('darkMode')}
            selection={model.themeMode}
            onSelectionChange={(v) => {
              const choice = model.themeChoices.find((c) => c.value === v);
              if (choice) model.setThemeMode(choice.value);
            }}
            modifiers={[pickerStyle('menu')]}>
            {model.themeChoices.map((c) => (
              <Text key={c.value} modifiers={[tag(c.value)]}>
                {c.label}
              </Text>
            ))}
          </Picker>
          <Picker<string>
            label={t('fontSize')}
            selection={model.fontSize}
            onSelectionChange={(v) => {
              const choice = model.fontChoices.find((c) => c.value === v);
              if (choice) model.setFontSize(choice.value);
            }}
            modifiers={[pickerStyle('menu')]}>
            {model.fontChoices.map((c) => (
              <Text key={c.value} modifiers={[tag(c.value)]}>
                {c.label}
              </Text>
            ))}
          </Picker>
          <Picker<string>
            label={t('language')}
            selection={model.language}
            onSelectionChange={(v) => {
              const choice = model.languageChoices.find((c) => c.value === v);
              if (choice) model.setLanguage(choice.value);
            }}
            modifiers={[pickerStyle('menu')]}>
            {model.languageChoices.map((c) => (
              <Text key={c.value} modifiers={[tag(c.value)]}>
                {c.label}
              </Text>
            ))}
          </Picker>
          <Toggle label={t('highContrast')} isOn={model.highContrast} onIsOnChange={model.setHighContrast} />
        </Section>

        <Section title={t('nativeSettingsNeeds')} footer={<Text>{t('nativeSettingsNeedsHint')}</Text>}>
          <Button label={t('nativeSettingsEditNeeds')} onPress={model.openNeeds} />
          <Text modifiers={secondary}>{model.needsSummary}</Text>
        </Section>

        <Section title={t('nativeHomeQuickServices')} footer={<Text>{t('nativeHomeShortcutsSettingsHint')}</Text>}>
          {model.quickActionOptions.map((option) => (
            <Toggle
              key={option.key}
              label={option.label}
              isOn={option.enabled}
              onIsOnChange={option.onToggle}
              modifiers={option.disabled ? [disabled(true)] : []}
            />
          ))}
        </Section>

        <Section title={t('settingsEmergencyTitle')} footer={<Text>{t('settingsEmergencyDesc')}</Text>}>
          <Button label={t('sosContactsManageTitle')} onPress={model.openContacts} />
        </Section>

        <Section title={t('notification')} footer={<Text>{t('nativePushDescription')}</Text>}>
          <Toggle label={t('notification')} isOn={model.notifications} onIsOnChange={model.setNotifications} />
          <Text modifiers={secondary}>{model.notificationStatusText}</Text>
          {model.notificationAction ? <Button label={model.notificationActionLabel} onPress={model.notificationAction} /> : null}
        </Section>

        <Section title={t('nativeSettingsReports')}>
          <Button label={t('contentBlocks')} onPress={model.openBlocks} />
          <Button label={t('nativeMyReports')} onPress={model.openReports} />
        </Section>

        <Section title={t('aiMemoryTitle')} footer={<Text>{t('aiMemoryDesc')}</Text>}>
          <Button label={t('aiMemoryTitle')} onPress={model.openMemory} />
        </Section>

        <Section title={t('settingsDataTitle')}>
          <Button label={t('settingsDataTitle')} onPress={model.openData} />
          <Button label={t('resetGuides')} onPress={model.resetGuides} />
        </Section>

        <Section>
          {model.legalLinks.map((link) => (
            <Button key={link.key} label={link.label} onPress={link.open} />
          ))}
          <LabeledContent label={t('nativeAppVersion')}>
            <Text modifiers={secondary}>{model.version}</Text>
          </LabeledContent>
        </Section>
      </Form>
    </Host>
  );
}
