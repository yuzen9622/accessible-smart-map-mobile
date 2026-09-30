import type { FacilityDetailModel } from '../hooks/useFacilityDetail';

export interface FacilityDetailPanelProps {
  model: Extract<FacilityDetailModel, { status: 'ready' }>;
}
