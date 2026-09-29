import SosTrackerPanel from '../components/SosTrackerPanel';
import { useSosTracker } from '../hooks/useSosTracker';

export default function SosTrackerScreen({ token }: { token: string | undefined }) {
  return <SosTrackerPanel model={useSosTracker(token)} />;
}
