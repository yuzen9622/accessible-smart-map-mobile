import { Form, Picker, Section, Text, TextField, VStack, useNativeState } from '@expo/ui/swift-ui';
import { font, labelsHidden, lineLimit, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import { useAppTranslation } from '@/shared/i18n';
import { FormPrimaryButton, KeyboardAvoidingHost } from '@/shared/ui';

import type { ReviewFormPanelProps } from './ReviewFormPanel.types';

const SCORES = [1, 2, 3, 4, 5];

/** iOS：每一項以 segmented Picker 選 1–5 分（VoiceOver 可逐項調整，比星星圖示好操作）。 */
export default function ReviewFormPanel({ model }: ReviewFormPanelProps) {
  const { t } = useAppTranslation();
  const commentState = useNativeState(model.comment);
  return (
    <KeyboardAvoidingHost>
      <Form>
        <Section title={model.placeName} footer={<Text>{t('reviewRatingRequired')}</Text>}>
          {/* segmented Picker 在 Form 裡不會顯示 label（截圖只剩四排 1–5，看不出在評什麼）：標題另外畫在上方 */}
          {model.ratings.map((rating) => (
            <VStack key={rating.key} alignment="leading" spacing={8}>
              <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>{rating.label}</Text>
              <Picker<number>
                label={rating.label}
                selection={rating.value}
                onSelectionChange={rating.onChange}
                modifiers={[pickerStyle('segmented'), labelsHidden()]}>
                {SCORES.map((score) => (
                  <Text key={score} modifiers={[tag(score)]}>
                    {`${score}`}
                  </Text>
                ))}
              </Picker>
            </VStack>
          ))}
        </Section>
        <Section title={t('nativeReviewEvidenceTitle')} footer={<Text>{t('nativeReviewEvidenceFooter')}</Text>}>
          {model.evidence.map((field) => (
            <VStack key={field.key} alignment="leading" spacing={8}>
              <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' })]}>{field.label}</Text>
              <Picker<string>
                label={field.label}
                selection={field.value}
                onSelectionChange={field.onChange}
                modifiers={[pickerStyle(field.menu ? 'menu' : 'segmented'), labelsHidden()]}>
                {field.options.map((option) => (
                  <Text key={option.value} modifiers={[tag(option.value)]}>
                    {option.label}
                  </Text>
                ))}
              </Picker>
            </VStack>
          ))}
        </Section>
        <Section title={t('nativeReviewComment')}>
          <TextField
            text={commentState}
            placeholder={t('reviewPlaceholder')}
            axis="vertical"
            maxLength={500}
            onTextChange={model.setComment}
            modifiers={[lineLimit(6, { reservesSpace: true })]}
          />
        </Section>
        <Section>
          <FormPrimaryButton label={model.submitLabel} onPress={model.submit} loading={model.submitting} />
        </Section>
      </Form>
    </KeyboardAvoidingHost>
  );
}
