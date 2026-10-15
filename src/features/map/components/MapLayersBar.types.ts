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
  is3d: boolean;
  onToggle3d: () => void;
  /** 電梯／坡道／廁所／停車 */
  facilityToggles: MapLayersBarToggle[];
}
