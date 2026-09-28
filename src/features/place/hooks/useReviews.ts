import { useEffect, useRef, useState } from 'react';

import { getPlaceReviews, getReviewSummary } from '../api/reviews';
import type { PlaceReviewType, ReviewItem, ReviewSummaryResult } from '../types/review';

const PAGE_SIZE = 10;

interface UseReviewsResult {
  reviews: ReviewItem[];
  summary: ReviewSummaryResult | null;
  totalCount: number;
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  hasMore: boolean;
  loadMore: () => void;
}

/**
 * 移植自 Web `PlaceReviewSection.tsx`（commit 5eadc71）的讀取路徑：
 * `PAGE_SIZE = 10`；以 `${placeId}|${placeType}` 為 key，切換地點時整組
 * local state 重置；掛載時用 `Promise.all` 平行載入第一頁評論與 AI 摘要；
 * "load more" 用 `activePlaceKeyRef` 擋掉切換地點後仍在飛行中的舊請求。
 * Phase 1.3 只做讀取路徑；撰寫／編輯／刪除評論（需登入）留給之後的功能。
 */
export function useReviews(placeId: string, placeType: PlaceReviewType): UseReviewsResult {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<ReviewSummaryResult | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const placeKey = `${placeId}|${placeType}`;
  const activePlaceKeyRef = useRef(placeKey);

  useEffect(() => {
    const controller = new AbortController();
    activePlaceKeyRef.current = placeKey;

    void (async () => {
      setReviews([]);
      setSummary(null);
      setTotalCount(0);
      setTotalPages(1);
      setPage(1);
      setError(false);
      setLoading(true);
      try {
        const [listRes, summaryRes] = await Promise.all([
          getPlaceReviews({ placeId, placeType, page: 1, limit: PAGE_SIZE }, controller.signal),
          getReviewSummary({ placeId, placeType }, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        if (listRes.data) {
          setReviews(listRes.data.items);
          setTotalCount(listRes.data.totalCount);
          setTotalPages(listRes.data.totalPages);
          setPage(listRes.data.page);
        }
        if (summaryRes.data) setSummary(summaryRes.data);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [placeId, placeType, placeKey]);

  const loadMore = () => {
    if (page >= totalPages || loadingMore) return;
    const requestedKey = placeKey;
    setLoadingMore(true);
    void (async () => {
      try {
        const res = await getPlaceReviews({ placeId, placeType, page: page + 1, limit: PAGE_SIZE });
        if (activePlaceKeyRef.current !== requestedKey) return;
        if (res.data) {
          const data = res.data;
          setReviews((prev) => [...prev, ...data.items]);
          setPage(data.page);
          setTotalPages(data.totalPages);
        }
      } catch {
        if (activePlaceKeyRef.current === requestedKey) setError(true);
      } finally {
        if (activePlaceKeyRef.current === requestedKey) setLoadingMore(false);
      }
    })();
  };

  return { reviews, summary, totalCount, loading, loadingMore, error, hasMore: page < totalPages, loadMore };
}
