import type {
  ExploreNearbySummary,
  ExploreQuickAction,
  ExploreRow,
  ExploreShortcut,
  ExploreViewModel,
} from '../hooks/useExploreViewModel';

export type { ExploreNearbySummary, ExploreQuickAction, ExploreRow, ExploreShortcut };

export interface ExplorePanelProps {
  model: ExploreViewModel;
}
