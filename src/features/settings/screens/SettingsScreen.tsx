import SettingsPanel from '../components/SettingsPanel';
import { useSettingsViewModel } from '../hooks/useSettingsViewModel';

export default function SettingsScreen() {
  const model = useSettingsViewModel();
  return <SettingsPanel model={model} />;
}
