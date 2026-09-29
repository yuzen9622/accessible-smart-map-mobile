import { Button, Form, Host, Picker, ProgressView, Section, Text, TextField, useNativeState } from '@expo/ui/swift-ui';
import { buttonStyle, lineLimit, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import { useAppTranslation } from '@/shared/i18n';

import type { ReviewFormPanelProps } from './ReviewFormPanel.types';

const SCORES = [1, 2, 3, 4, 5];

/** iOS：每一項以 segmented Picker 選 1–5 分（VoiceOver 可逐項調整，比星星圖示好操作）。 */
export default function ReviewFormPanel({ model }: ReviewFormPanelProps) {
  const { t } = useAppTranslation();
  const commentState = useNativeState(model.comment);
  return (
    <Host style={{ flex: 1 }}>
      <Form>
        <Section title={model.placeName} footer={<Text>{t('reviewRatingRequired')}</Text>}>
          {model.ratings.map((rating) => (
            <Picker<number>
              key={rating.key}
              label={rating.label}
              selection={rating.value}
              onSelectionChange={rating.onChange}
              modifiers={[pickerStyle('segmented')]}>
              {SCORES.map((score) => (
                <Text key={score} modifiers={[tag(score)]}>
                  {`${score}`}
                </Text>
              ))}
            </Picker>
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
          {model.submitting ? (
            <ProgressView />
          ) : (
            <Button label={model.submitLabel} onPress={model.submit} modifiers={[buttonStyle('borderedProminent')]} />
          )}
        </Section>
      </Form>
    </Host>
  );
}
