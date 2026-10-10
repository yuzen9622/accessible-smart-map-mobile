import { captureContentContext } from '@/features/content-safety';
import { ApiError, authenticatedRequest, fetchRequest, getAccessToken, type ApiResponse } from '@/shared/api';
import { getAppConfig } from '@/shared/config';

import type { PlaceReviewType, ReviewEvidence, ReviewItem, ReviewListResult, ReviewSummaryResult } from '../types/review';

/**
 * 移植自 Web `src/lib/api/review.ts`（commit 5eadc71）。Phase 1.3 只需要讀取
 * 路徑（`getPlaceReviews`／`getReviewSummary`）；建立／修改／刪除（需登入）
 * 留給之後的評論撰寫功能。
 */

function basePath(): string {
  return '/api/v1/a11y/reviews';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isReviewItem(value: unknown): value is ReviewItem {
  return (
    isRecord(value) &&
    typeof value._id === 'string' &&
    typeof value.userId === 'string' &&
    typeof value.rating === 'number' &&
    typeof value.passageWidthRating === 'number' &&
    typeof value.toiletRating === 'number' &&
    typeof value.elevatorRating === 'number' &&
    typeof value.serviceRating === 'number' &&
    typeof value.createdAt === 'string'
  );
}

function isReviewListResult(value: unknown): value is ReviewListResult {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isReviewItem) &&
    (value.avgRating === null || typeof value.avgRating === 'number') &&
    typeof value.totalCount === 'number' &&
    typeof value.page === 'number' &&
    typeof value.totalPages === 'number'
  );
}

function isReviewSummaryResult(value: unknown): value is ReviewSummaryResult {
  return (
    isRecord(value) &&
    (value.avgRating === null || typeof value.avgRating === 'number') &&
    typeof value.totalCount === 'number' &&
    (value.summary === null || typeof value.summary === 'string') &&
    (value.highlights === null || Array.isArray(value.highlights))
  );
}

export interface GetPlaceReviewsParams {
  placeId: string;
  placeType: PlaceReviewType;
  page?: number;
  limit?: number;
  /** 只回傳總合無障礙分數 ≥ 此值（1–5）的評價；`totalCount`／`avgRating` 也用同一篩選集合。 */
  minAggregateScore?: number;
}

export async function getPlaceReviews(
  params: GetPlaceReviewsParams,
  signal?: AbortSignal,
): Promise<ApiResponse<ReviewListResult>> {
  const query = new URLSearchParams({
    placeId: params.placeId,
    placeType: params.placeType,
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 10),
  });
  if (params.minAggregateScore !== undefined) query.set('minAggregateScore', String(params.minAggregateScore));
  const url = `${getAppConfig().apiBaseUrl}${basePath()}?${query.toString()}`;
  const response = await fetchRequest(url, { signal, requireAuth: Boolean(getAccessToken()), isCurrent: captureContentContext() });
  const data = isReviewListResult(response.data) ? response.data : undefined;
  return { ...response, data } as ApiResponse<ReviewListResult>;
}

export interface GetReviewSummaryParams {
  placeId: string;
  placeType: PlaceReviewType;
}

export async function getReviewSummary(
  params: GetReviewSummaryParams,
  signal?: AbortSignal,
): Promise<ApiResponse<ReviewSummaryResult>> {
  const query = new URLSearchParams({ placeId: params.placeId, placeType: params.placeType });
  const url = `${getAppConfig().apiBaseUrl}${basePath()}/summary?${query.toString()}`;
  const response = await fetchRequest(url, { signal, requireAuth: Boolean(getAccessToken()), isCurrent: captureContentContext() });
  const data = isReviewSummaryResult(response.data) ? response.data : undefined;
  return { ...response, data } as ApiResponse<ReviewSummaryResult>;
}

export interface ReviewRatingsInput extends ReviewEvidence {
  passageWidthRating: number;
  toiletRating: number;
  elevatorRating: number;
  serviceRating: number;
  comment?: string;
}

/**
 * 撰寫／修改／刪除評論（需登入），移植自 Web `src/lib/api/review.ts` 的 `createReview`／`updateReview`／`deleteReview`
 * （commit f82cda8）。同一使用者對同一地點只能有一則有效評論（重複建立 → 400）。
 */
export async function createReview(placeId: string, placeType: PlaceReviewType, input: ReviewRatingsInput): Promise<void> {
  const res = await authenticatedRequest(basePath(), { method: 'POST', body: { placeId, placeType, ...input } });
  if (!(res.ok === true || res.success === true)) throw new ApiError(res.message, res.code);
}

export async function updateReview(id: string, input: ReviewRatingsInput): Promise<void> {
  const res = await authenticatedRequest(`${basePath()}/${encodeURIComponent(id)}`, { method: 'PATCH', body: input });
  if (!(res.ok === true || res.success === true)) throw new ApiError(res.message, res.code);
}

export async function deleteReview(id: string): Promise<void> {
  const res = await authenticatedRequest(`${basePath()}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!(res.ok === true || res.success === true)) throw new ApiError(res.message, res.code);
}
