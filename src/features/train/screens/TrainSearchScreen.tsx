import TrainSearchPanel from '../components/TrainSearchPanel';
import { useTrainSearchViewModel } from '../hooks/useTrainSearchViewModel';

export default function TrainSearchScreen() {
  const model = useTrainSearchViewModel();
  return <TrainSearchPanel model={model} />;
}
