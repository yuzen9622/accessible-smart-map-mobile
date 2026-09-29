import type { EntranceAccessibility, ReviewEvidence, ReviewItem } from '../types/review';

/**
 * 結構化無障礙評價（後端 `FRONTEND_MIGRATION_STRUCTURED_ACCESSIBILITY_REVIEWS.md`）。
 * 五個欄位都是選填；欄位缺漏＝「未評估」，絕不能當成 false 顯示。
 */
export const ENTRANCE_VALUES: readonly EntranceAccessibility[] = ['step_free', 'ramp', 'stairs_with_assistance', 'inaccessible'];

export const UNSET = 'unset';

export type BooleanEvidenceKey = 'toiletTurningRoom' | 'wheelchairTableHeight' | 'adequateAisleWidth';
export const BOOLEAN_EVIDENCE_KEYS: readonly BooleanEvidenceKey[] = ['toiletTurningRoom', 'wheelchairTableHeight', 'adequateAisleWidth'];

export type Translate = (key: string) => string;

/** 表單狀態 → API 欄位；「未評估」的欄位不送。 */
export function toEvidencePayload(form: {
  entrance: string;
  booleans: Record<BooleanEvidenceKey, string>;
  staff: string;
}): ReviewEvidence {
  const payload: ReviewEvidence = {};
  const entrance = ENTRANCE_VALUES.find((v) => v === form.entrance);
  if (entrance) payload.entranceAccessibility = entrance;
  for (const key of BOOLEAN_EVIDENCE_KEYS) {
    if (form.booleans[key] === 'yes') payload[key] = true;
    else if (form.booleans[key] === 'no') payload[key] = false;
  }
  const staff = Number(form.staff);
  if (Number.isInteger(staff) && staff >= 1 && staff <= 5) payload.staffHelpfulnessRating = staff;
  return payload;
}

export function booleanToChoice(value: boolean | undefined): string {
  return value === undefined ? UNSET : value ? 'yes' : 'no';
}

/** 列表上每則評價的證據摘要；只列出有評估的項目。 */
export function evidenceLines(review: ReviewItem, t: Translate): string[] {
  const lines: string[] = [];
  if (review.entranceAccessibility) lines.push(`${t('nativeReviewEntrance')}：${t(`nativeReviewEntrance_${review.entranceAccessibility}`)}`);
  for (const key of BOOLEAN_EVIDENCE_KEYS) {
    const value = review[key];
    if (value !== undefined) lines.push(`${t(`nativeReviewEvidence_${key}`)}：${value ? t('nativeReviewYes') : t('nativeReviewNo')}`);
  }
  if (review.staffHelpfulnessRating !== undefined) lines.push(`${t('nativeReviewStaff')}：${review.staffHelpfulnessRating}/5`);
  return lines;
}
