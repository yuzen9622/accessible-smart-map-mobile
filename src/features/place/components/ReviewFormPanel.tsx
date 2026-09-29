import { useAppTranslation } from '@/shared/i18n';
import { FormButton, FormInput, FormScreen, FormSection, FormSegmented, FormText } from '@/shared/ui';

import type { ReviewFormPanelProps } from './ReviewFormPanel.types';

const SCORES = ['1', '2', '3', '4', '5'] as const;

export default function ReviewFormPanel({ model }: ReviewFormPanelProps) {
  const { t } = useAppTranslation();
  return (
    <FormScreen>
      <FormSection title={model.placeName} footer={t('reviewRatingRequired')}>
        {model.ratings.map((rating) => (
          <FormSection key={rating.key}>
            <FormText tone="secondary">{rating.label}</FormText>
            <FormSegmented
              label={rating.label}
              value={rating.value ? String(rating.value) : ''}
              choices={SCORES.map((s) => ({ value: s, label: s }))}
              onChange={(v) => rating.onChange(Number(v))}
            />
          </FormSection>
        ))}
      </FormSection>
      <FormSection title={t('nativeReviewComment')}>
        <FormInput label={t('reviewPlaceholder')} value={model.comment} onChangeText={model.setComment} maxLength={500} multiline />
      </FormSection>
      <FormButton label={model.submitLabel} loading={model.submitting} onPress={model.submit} />
    </FormScreen>
  );
}
