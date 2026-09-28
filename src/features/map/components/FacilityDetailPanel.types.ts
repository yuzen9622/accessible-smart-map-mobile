import type { FacilityDetailRow } from '../hooks/useFacilityDetail';

export interface FacilityDetailPanelProps {
  title: string;
  rows: FacilityDetailRow[];
  showOnMapLabel: string;
  onShowOnMap: () => void;
}
