import LineBindPanel from '../components/LineBindPanel';
import { useLineBind } from '../hooks/useLineBind';

export default function LineBindScreen() {
  const model = useLineBind();
  return <LineBindPanel model={model} />;
}
