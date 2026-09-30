import { useState } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';
import { useCloseScreen } from '@/shared/navigation';

import { createReview, updateReview } from '../api/reviews';
import { BOOLEAN_EVIDENCE_KEYS, ENTRANCE_VALUES, UNSET, booleanToChoice, toEvidencePayload, type BooleanEvidenceKey } from '../domain/reviewEvidence';
import { bumpReviewRevision, useReviewEditorStore } from '../store/reviewEditorStore';

export type RatingKey = 'passageWidthRating' | 'toiletRating' | 'elevatorRating' | 'serviceRating';

const RATING_LABEL_KEY: Record<RatingKey, string> = {
  passageWidthRating: 'passageWidth',
  toiletRating: 'restroomQuality',
  elevatorRating: 'elevatorCondition',
  serviceRating: 'serviceAttitude',
};

const RATING_KEYS: RatingKey[] = ['passageWidthRating', 'toiletRating', 'elevatorRating', 'serviceRating'];

/**
 * 撰寫／編輯評論，對齊 Web `PlaceReviewSection.tsx` 的表單（commit f82cda8）：四項 1–5 分必填、評語最多 500 字；
 * 送出後重新載入第一頁（不做樂觀更新）。
 */
export function useReviewForm() {
  const { t } = useAppTranslation();
  const closeScreen = useCloseScreen();
  const target = useReviewEditorStore((s) => s.target);
  const existing = target?.review ?? null;
  const [ratings, setRatings] = useState<Record<RatingKey, number>>({
    passageWidthRating: existing?.passageWidthRating ?? 0,
    toiletRating: existing?.toiletRating ?? 0,
    elevatorRating: existing?.elevatorRating ?? 0,
    serviceRating: existing?.serviceRating ?? 0,
  });
  const [entrance, setEntrance] = useState<string>(existing?.entranceAccessibility ?? UNSET);
  const [booleans, setBooleans] = useState<Record<BooleanEvidenceKey, string>>({
    toiletTurningRoom: booleanToChoice(existing?.toiletTurningRoom),
    wheelchairTableHeight: booleanToChoice(existing?.wheelchairTableHeight),
    adequateAisleWidth: booleanToChoice(existing?.adequateAisleWidth),
  });
  const [staff, setStaff] = useState<string>(existing?.staffHelpfulnessRating ? String(existing.staffHelpfulnessRating) : UNSET);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!target || submitting) return;
    if (RATING_KEYS.some((key) => !Number.isInteger(ratings[key]) || ratings[key] < 1 || ratings[key] > 5)) {
      Alert.alert(t('reviewRatingRequired'));
      return;
    }
    const trimmed = comment.trim();
    if (trimmed.length > 500) {
      Alert.alert(t('nativeReviewTooLong'));
      return;
    }
    setSubmitting(true);
    try {
      const input = { ...ratings, ...toEvidencePayload({ entrance, booleans, staff }), ...(trimmed ? { comment: trimmed } : {}) };
      if (existing) await updateReview(existing._id, input);
      else await createReview(target.placeId, target.placeType, input);
      bumpReviewRevision();
      AccessibilityInfo.announceForAccessibility(existing ? t('reviewUpdated') : t('reviewSubmitted'));
      closeScreen();
    } catch (error) {
      Alert.alert(error instanceof Error && error.message ? error.message : t('reviewSubmitError'));
    } finally {
      setSubmitting(false);
    }
  };

  return {
    placeName: target?.placeName ?? '',
    editing: Boolean(existing),
    missingTarget: !target,
    ratings: RATING_KEYS.map((key) => ({
      key,
      label: t(RATING_LABEL_KEY[key]),
      value: ratings[key],
      onChange: (value: number) => setRatings((prev) => ({ ...prev, [key]: value })),
    })),
    evidence: [
      {
        key: 'entranceAccessibility',
        label: t('nativeReviewEntrance'),
        menu: true,
        options: [
          { value: UNSET, label: t('nativeReviewNotAssessed') },
          ...ENTRANCE_VALUES.map((value) => ({ value, label: t(`nativeReviewEntrance_${value}`) })),
        ],
        value: entrance,
        onChange: setEntrance,
      },
      ...BOOLEAN_EVIDENCE_KEYS.map((key) => ({
        key,
        label: t(`nativeReviewEvidence_${key}`),
        menu: false,
        options: [
          { value: UNSET, label: t('nativeReviewNotAssessed') },
          { value: 'yes', label: t('nativeReviewYes') },
          { value: 'no', label: t('nativeReviewNo') },
        ],
        value: booleans[key],
        onChange: (value: string) => setBooleans((prev) => ({ ...prev, [key]: value })),
      })),
      {
        key: 'staffHelpfulnessRating',
        label: t('nativeReviewStaff'),
        menu: false,
        options: [{ value: UNSET, label: '–' }, ...['1', '2', '3', '4', '5'].map((value) => ({ value, label: value }))],
        value: staff,
        onChange: setStaff,
      },
    ],
    comment,
    setComment,
    submitting,
    submitLabel: existing ? t('reviewUpdate') : t('submitReview'),
    submit: () => void submit(),
  };
}

export type ReviewFormModel = ReturnType<typeof useReviewForm>;
