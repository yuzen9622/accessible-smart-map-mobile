// 移植自 Web `src/types/review.ts`（commit 5eadc71）。Phase 1.3 只需要讀取路徑
// （列表、摘要）；建立/修改/刪除留給登入後的評論撰寫功能（未來 phase）。
import type { PlaceReviewType } from './place';

export type { PlaceReviewType };

export interface ReviewItem {
  _id: string;
  userId: string;
  rating: number;
  passageWidthRating: number;
  toiletRating: number;
  elevatorRating: number;
  serviceRating: number;
  comment?: string;
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
