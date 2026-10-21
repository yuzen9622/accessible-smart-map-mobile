import type { SFSymbol } from 'expo-symbols';

import type { IconName } from '@/shared/ui/Icon.types';

export interface MapLayersBarToggle {
  key: string;
  label: string;
  /** Android／fallback 用 Lucide 圖示名稱 */
  iconName: IconName;
  systemImage: SFSymbol;
  selected: boolean;
  onToggle: () => void;
}

export interface MapLayersBarProps {
  /** 電梯／坡道／廁所／停車；2D／3D 是獨立的常駐按鈕（見 `MapControls`），不在這排裡
   * （使用者回饋：這排圖示都長一樣，分不出哪顆是在切視角）。 */
  facilityToggles: MapLayersBarToggle[];
}
