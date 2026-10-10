import { router } from 'expo-router';
import { useAppTranslation } from '@/shared/i18n';
import { FormButton, FormInput, FormRow, FormScreen, FormSection, FormText } from '@/shared/ui';
import { REPORT_REASONS } from '../domain/types';
import type { ContentReportPanelProps } from './ContentReportPanel.types';

export default function ContentReportPanel({ model }: ContentReportPanelProps) {
  const { t, i18n } = useAppTranslation();
  return <FormScreen>
    {model.receipt ? <FormSection title={t('contentReceived')}>
      <FormText>{t('contentReceivedExplanation')}</FormText>
      <FormText>{t('contentCaseNumber', { number: model.receipt.caseNumber })}</FormText>
      <FormText>{t('contentReceivedAt', { time: new Date(model.receipt.receivedAt).toLocaleString(i18n.language) })}</FormText>
      <FormText>{t(model.receipt.confirmationEmail === 'queued' ? 'contentEmailQueued' : 'contentEmailUnavailable')}</FormText>
      <FormButton label={t('contentDone')} onPress={() => router.back()} />
    </FormSection> : <>
      <FormSection title={t('contentReason')} footer={t('contentReportExplanation')}>
        {REPORT_REASONS.map(reason => <FormRow key={reason} label={t(`contentReason_${reason}`)} value={reason === model.reason ? '✓' : undefined} disabled={model.submitting} onPress={() => model.setReason(reason)} />)}
      </FormSection>
      <FormSection title={t('contentDetails')} footer={t('contentDetailsHint')}>
        <FormInput label={t('contentDetails')} value={model.details} onChangeText={model.setDetails} maxLength={1000} multiline />
      </FormSection>
      <FormSection>
        {model.error ? <FormText tone="error">{model.error}</FormText> : null}
        <FormButton label={t('contentSubmit')} onPress={model.submit} disabled={!model.valid} loading={model.submitting} />
      </FormSection>
    </>}
  </FormScreen>;
}
