import SavedPlacesPanel from '../components/SavedPlacesPanel';
import { useSavedPlacesViewModel } from '../hooks/useSavedPlacesViewModel';

/** `(sheet)/saved` 路由：呼叫 view-model，交給平台專屬的 `SavedPlacesPanel` 呈現。 */
export default function SavedPlacesScreen() {
  const model = useSavedPlacesViewModel();
  return <SavedPlacesPanel model={model} />;
}
