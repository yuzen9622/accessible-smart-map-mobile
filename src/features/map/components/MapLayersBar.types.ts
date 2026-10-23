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

export interface MapLayersBarNeedsPill {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}

export interface MapLayersBarProps {
  /** 電梯／坡道／廁所／停車；2D／3D 是獨立的常駐按鈕（見 `MapControls`），不在這排裡
   * （使用者回饋：這排圖示都長一樣，分不出哪顆是在切視角）。 */
  facilityToggles: MapLayersBarToggle[];
  /** 「行動需求」膠囊（例：「一般」），排在設施篩選列最後一顆；跟 `(sheet)/explore` 以前自己的
   * 行動需求 pill 是同一個入口，收進這排常駐列，不要兩處都能點（使用者回饋 2026-10-23：設施篩選跟
   * 行動需求應該合併成同一條常駐列）。 */
  needsPill?: MapLayersBarNeedsPill;
}
