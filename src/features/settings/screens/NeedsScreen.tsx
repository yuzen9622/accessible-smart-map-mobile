import NeedsPanel from '../components/NeedsPanel';
import { useNeedsViewModel } from '../hooks/useNeedsViewModel';

export default function NeedsScreen() {
  return <NeedsPanel model={useNeedsViewModel()} />;
}
