import { useEffect, useRef, useState } from 'react';
import { useContentSafetyStore } from '@/features/content-safety';
import { getPlaceReviews, getReviewSummary } from '../api/reviews';
import { useReviewEditorStore } from '../store/reviewEditorStore';
import type { PlaceReviewType, ReviewItem, ReviewSummaryResult } from '../types/review';

const PAGE_SIZE = 10;
/** Account and content revisions own both list and summary; old pagination cannot append after invalidation. */
export function useReviews(placeId: string, placeType: PlaceReviewType) {
  const revision = useReviewEditorStore(state => state.revision);
  const safetyRevision = useContentSafetyStore(state => state.revision);
  const [attempt, setAttempt] = useState(0);
  const retry = () => setAttempt(value => value + 1);
  const key = `${placeId}|${placeType}|${revision}|${safetyRevision}|${attempt}`;
  const activeKey = useRef(key);
  const [state, setState] = useState<{ key: string; reviews: ReviewItem[]; summary: ReviewSummaryResult | null; totalCount: number; totalPages: number; page: number; loading: boolean; loadingMore: boolean; error: boolean }>({ key, reviews: [], summary: null, totalCount: 0, totalPages: 1, page: 1, loading: true, loadingMore: false, error: false });
  const generation = useRef(0);
  const paging = useRef(false);
  useEffect(() => {
    activeKey.current = key;
    const controller = new AbortController();
    const request = ++generation.current;
    paging.current = false;
    const load = async () => {
      try {
        const [list, summary] = await Promise.all([
          getPlaceReviews({ placeId, placeType, page: 1, limit: PAGE_SIZE }, controller.signal),
          getReviewSummary({ placeId, placeType }, controller.signal),
        ]);
        if (controller.signal.aborted || request !== generation.current || activeKey.current !== key) return;
        setState({ key, reviews: list.data?.items ?? [], summary: summary.data ?? null, totalCount: list.data?.totalCount ?? 0, totalPages: list.data?.totalPages ?? 1, page: 1, loading: false, loadingMore: false, error: false });
      } catch {
        if (!controller.signal.aborted && request === generation.current && activeKey.current === key) setState({ key, reviews: [], summary: null, totalCount: 0, totalPages: 1, page: 1, loading: false, loadingMore: false, error: true });
      }
    };
    void load();
    return () => { controller.abort(); generation.current = request + 1; };
  }, [key, placeId, placeType]);
  const loadMore = () => {
    if (state.key !== key || state.loading || state.page >= state.totalPages || paging.current) return;
    const request = generation.current;
    paging.current = true;
    setState(previous => ({ ...previous, loadingMore: true }));
    const load = async () => {
      try {
        const result = await getPlaceReviews({ placeId, placeType, page: state.page + 1, limit: PAGE_SIZE });
        if (request !== generation.current || activeKey.current !== key || !result.data) return;
        const data = result.data;
        setState(previous => ({ ...previous, reviews: [...previous.reviews, ...data.items], page: data.page, totalPages: data.totalPages }));
      } catch {
        if (request === generation.current && activeKey.current === key) setState(previous => ({ ...previous, error: true }));
      } finally {
        if (request === generation.current && activeKey.current === key) { paging.current = false; setState(previous => ({ ...previous, loadingMore: false })); }
      }
    };
    void load();
  };
  if (state.key !== key) return { reviews: [], summary: null, totalCount: 0, loading: true, loadingMore: false, error: false, hasMore: false, loadMore, retry };
  return { ...state, hasMore: state.page < state.totalPages, loadMore, retry };
}
