import type { NearbyViewModel } from '../hooks/useNearbyViewModel';

export interface NearbyPanelProps {
  model: NearbyViewModel;
  /** 無定位時的「開啟定位」動作 */
  onRequestLocation: () => void;
  labels: {
    filterLabel: string;
    empty: string;
    noLocation: string;
    locate: string;
    loading: string;
  };
}
