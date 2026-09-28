import ExplorePanel from '../components/ExplorePanel';
import { useExploreViewModel } from '../hooks/useExploreViewModel';

/** `(sheet)/explore` 路由：呼叫 view-model，交給平台專屬的 `ExplorePanel` 呈現。 */
export default function ExploreScreen() {
  const model = useExploreViewModel();
  return <ExplorePanel model={model} />;
}
