import type {
  ExploreNearbySummary,
  ExploreRow,
  ExploreShortcut,
  ExploreViewModel,
} from '../hooks/useExploreViewModel';

export type { ExploreNearbySummary, ExploreRow, ExploreShortcut };

export interface ExplorePanelProps {
  model: ExploreViewModel;
}
