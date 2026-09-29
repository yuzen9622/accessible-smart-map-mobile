// 移植自 Web `src/types/review.ts`（commit 5eadc71）。Phase 1.3 只需要讀取路徑
// （列表、摘要）；建立/修改/刪除留給登入後的評論撰寫功能（未來 phase）。
import type { PlaceReviewType } from './place';

export type { PlaceReviewType };

export type EntranceAccessibility = 'step_free' | 'ramp' | 'stairs_with_assistance' | 'inaccessible';

/** 結構化無障礙證據（皆選填）。回應缺欄位＝未評估，不可推斷為 false。 */
export interface ReviewEvidence {
  entranceAccessibility?: EntranceAccessibility;
  toiletTurningRoom?: boolean;
  wheelchairTableHeight?: boolean;
  adequateAisleWidth?: boolean;
  /** 1–5 整數。 */
  staffHelpfulnessRating?: number;
}

export interface ReviewItem extends ReviewEvidence {
  _id: string;
  userId: string;
  rating: number;
  passageWidthRating: number;
  toiletRating: number;
  elevatorRating: number;
  serviceRating: number;
  comment?: string;
  /** 後端衍生的總合無障礙分數（1–5），只出現在 response。 */
  aggregateAccessibilityScore?: number;
  createdAt: string;
}

export interface ReviewListResult {
  items: ReviewItem[];
  avgRating: number | null;
  totalCount: number;
  page: number;
  totalPages: number;
}

export interface ReviewSummaryResult {
  avgRating: number | null;
  totalCount: number;
  /** AI 產生的摘要／重點，兩者皆可能為 null（尚無評論或尚未產生摘要）。 */
  summary: string | null;
  highlights: string[] | null;
}
