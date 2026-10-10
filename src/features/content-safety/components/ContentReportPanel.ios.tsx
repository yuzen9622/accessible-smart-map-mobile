import { router } from 'expo-router';
import { Picker, Text, TextField, useNativeState } from '@expo/ui/swift-ui';
import { disabled, labelsHidden, lineLimit, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { useAppTranslation } from '@/shared/i18n';
import { FormPrimaryButton, KeyboardAvoidingHost } from '@/shared/ui';
import { Form, Section, Button } from '@/shared/ui/form/PreferenceForm.ios';
import { REPORT_REASONS } from '../domain/types';
import type { ContentReportPanelProps } from './ContentReportPanel.types';

export default function ContentReportPanel({ model }: ContentReportPanelProps) {
  const { t, i18n } = useAppTranslation();
  const details = useNativeState(model.details);
  return <KeyboardAvoidingHost><Form>
    {model.receipt ? <Section title={t('contentReceived')}>
      <Text>{t('contentReceivedExplanation')}</Text>
      <Text>{t('contentCaseNumber', { number: model.receipt.caseNumber })}</Text>
      <Text>{t('contentReceivedAt', { time: new Date(model.receipt.receivedAt).toLocaleString(i18n.language) })}</Text>
      <Text>{t(model.receipt.confirmationEmail === 'queued' ? 'contentEmailQueued' : 'contentEmailUnavailable')}</Text>
      <Button label={t('contentDone')} onPress={() => router.back()} />
    </Section> : <>
      <Section title={t('contentReason')} footer={<Text>{t('contentReportExplanation')}</Text>}>
        <Picker<string> label={t('contentReason')} selection={model.reason} onSelectionChange={value => { const reason = REPORT_REASONS.find(r => r === value); if (reason) model.setReason(reason); }} modifiers={[pickerStyle('inline'), labelsHidden(), disabled(model.submitting)]}>
          <Text modifiers={[tag('')]}>{t('contentSelectReason')}</Text>
          {REPORT_REASONS.map(reason => <Text key={reason} modifiers={[tag(reason)]}>{t(`contentReason_${reason}`)}</Text>)}
        </Picker>
      </Section>
      <Section title={t('contentDetails')} footer={<Text>{t('contentDetailsHint')}</Text>}>
        <TextField text={details} placeholder={t('contentDetails')} axis="vertical" maxLength={1000} onTextChange={model.setDetails} modifiers={[lineLimit(5, { reservesSpace: true }), disabled(model.submitting)]} />
      </Section>
      <Section>
        {model.error ? <Text>{model.error}</Text> : null}
        <FormPrimaryButton label={t('contentSubmit')} onPress={model.submit} disabled={!model.valid} loading={model.submitting} />
      </Section>
    </>}
  </Form></KeyboardAvoidingHost>;
}
