import { usePlaceDetailViewModel } from '../hooks/usePlaceDetailViewModel';
import type { PlaceDetail } from '../types/place';
import PlaceDetailView from './PlaceDetailView';

export interface PlaceDetailPanelProps {
  entry: PlaceDetail;
  loading?: boolean;
}

/**
 * `(sheet)/place/[id]` 與 `(sheet)/loc/[coords]` 共用的入口，維持原本
 * `{ entry, loading }` 的對外介面不變（兩個路由檔都直接用這個 props 形狀，
 * 不需要改路由檔）。實際邏輯在 `usePlaceDetailViewModel`；呈現交給平台專屬
 * 的 `PlaceDetailView`。
 */
export default function PlaceDetailPanel({ entry, loading = false }: PlaceDetailPanelProps) {
  const model = usePlaceDetailViewModel(entry);
  return <PlaceDetailView model={model} loading={loading} />;
}
