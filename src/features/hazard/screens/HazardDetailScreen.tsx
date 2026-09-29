import HazardDetailPanel from '../components/HazardDetailPanel';
import { useHazardDetail } from '../hooks/useHazardDetail';

export default function HazardDetailScreen({ id }: { id: string | undefined }) {
  return <HazardDetailPanel model={useHazardDetail(id)} />;
}
