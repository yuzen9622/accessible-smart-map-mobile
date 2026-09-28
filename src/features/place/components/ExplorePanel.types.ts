import type {
  ExploreNearbyCard,
  ExploreQuickAction,
  ExploreRow,
  ExploreViewModel,
} from '../hooks/useExploreViewModel';

export type { ExploreNearbyCard, ExploreQuickAction, ExploreRow };

export interface ExplorePanelProps {
  model: ExploreViewModel;
}
