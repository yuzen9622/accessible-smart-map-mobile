import { create } from 'zustand';

import type { PlaceReviewType, ReviewItem } from '../types/review';

/**
 * 評論表單（root modal `/review`）要編輯哪個地點、哪則評論。路由參數只能帶字串，整則評論放這裡；
 * `revision` 在建立／修改／刪除後遞增，讓地點詳情的 `useReviews` 重新載入第一頁（對齊 Web 送出後 `loadFirstPage`）。
 */
interface ReviewEditorState {
  target: { placeId: string; placeType: PlaceReviewType; placeName: string; review: ReviewItem | null } | null;
  revision: number;
}

export const useReviewEditorStore = create<ReviewEditorState>(() => ({ target: null, revision: 0 }));

export function bumpReviewRevision(): void {
  useReviewEditorStore.setState((s) => ({ revision: s.revision + 1 }));
}
