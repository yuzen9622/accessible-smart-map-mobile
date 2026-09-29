import { router } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';

import { useAppTranslation } from '@/shared/i18n';

import { createReview, updateReview } from '../api/reviews';
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
  const target = useReviewEditorStore((s) => s.target);
  const existing = target?.review ?? null;
  const [ratings, setRatings] = useState<Record<RatingKey, number>>({
    passageWidthRating: existing?.passageWidthRating ?? 0,
    toiletRating: existing?.toiletRating ?? 0,
    elevatorRating: existing?.elevatorRating ?? 0,
    serviceRating: existing?.serviceRating ?? 0,
  });
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
      const input = { ...ratings, ...(trimmed ? { comment: trimmed } : {}) };
      if (existing) await updateReview(existing._id, input);
      else await createReview(target.placeId, target.placeType, input);
      bumpReviewRevision();
      AccessibilityInfo.announceForAccessibility(existing ? t('reviewUpdated') : t('reviewSubmitted'));
      router.back();
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
    comment,
    setComment,
    submitting,
    submitLabel: existing ? t('reviewUpdate') : t('submitReview'),
    submit: () => void submit(),
  };
}

export type ReviewFormModel = ReturnType<typeof useReviewForm>;
