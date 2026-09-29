import DataPanel from '../components/DataPanel';
import { useDataViewModel } from '../hooks/useDataViewModel';

export default function DataScreen() {
  return <DataPanel model={useDataViewModel()} />;
}
