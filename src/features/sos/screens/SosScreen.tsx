import SosPanel from '../components/SosPanel';
import { useSosFlow } from '../hooks/useSosFlow';

export default function SosScreen() {
  return <SosPanel model={useSosFlow()} />;
}
