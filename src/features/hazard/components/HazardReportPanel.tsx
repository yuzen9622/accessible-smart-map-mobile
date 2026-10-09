import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { FormButton, FormInput, FormScreen, FormSection, FormSegmented, FormText } from '@/shared/ui';

import HazardReportResult from './HazardReportResult';
import type { HazardReportPanelProps } from './HazardReportPanel.types';

export default function HazardReportPanel({ model }: HazardReportPanelProps) {
  const { t } = useAppTranslation();
  if (model.result) return <HazardReportResult model={model} result={model.result} />;
  return (
    <FormScreen>
      {!model.loggedIn ? (
        <FormSection>
          <FormText tone="secondary">{t('reportLoginHint')}</FormText>
          <FormButton label={t('loginRegisterCta')} variant="secondary" onPress={model.login} />
        </FormSection>
      ) : null}
      <FormSection title={t('hazardType')}>
        <FormSegmented label={t('hazardType')} value={model.hazardType} choices={model.typeChoices} onChange={model.setHazardType} />
      </FormSection>
      <FormSection title={t('hazardSeverity')}>
        <FormSegmented label={t('hazardSeverity')} value={model.severity} choices={model.severityChoices} onChange={model.setSeverity} />
      </FormSection>
      <FormSection title={t('hazardPhoto')} footer={t('photoRequirementHint')}>
        {model.photo ? (
          <>
            <Image source={{ uri: model.photo.uri }} style={styles.preview} contentFit="cover" accessibilityLabel={t('hazardPhoto')} />
            <FormButton label={t('nativeHazardRemovePhoto')} variant="secondary" onPress={model.removePhoto} />
          </>
        ) : null}
        <FormButton label={t('takePhoto')} variant="secondary" onPress={model.takePhoto} />
        <FormButton label={t('nativeHazardChooseFromLibrary')} variant="secondary" onPress={model.chooseFromLibrary} />
      </FormSection>
      <FormSection title={t('hazardDesc')}>
        <FormInput label={t('hazardDescPlaceholder')} value={model.description} onChangeText={model.setDescription} maxLength={500} multiline />
      </FormSection>
      <FormSection title={t('sosCurrentLocation')}>
        <FormText>{model.locationPrimary}</FormText>
        {model.locationSecondary ? <FormText tone="secondary">{model.locationSecondary}</FormText> : null}
      </FormSection>
      <FormButton label={t('submitReport')} loading={model.submitting} disabled={!model.canSubmit} onPress={model.submit} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  preview: { width: '100%', height: 200, borderRadius: 12, marginVertical: 6 },
});
