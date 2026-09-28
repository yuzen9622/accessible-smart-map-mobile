// 逐一 deep import：Metro 不做 tree-shaking，從 `lucide-react-native` barrel 具名匯入會把
// 全部圖示打進 bundle（iOS bundle 實測 +2.3 MB）。型別匯入會在編譯時清除。
import type { LucideIcon } from 'lucide-react-native';
import Accessibility from 'lucide-react-native/icons/accessibility';
import ArrowUpDown from 'lucide-react-native/icons/arrow-up-down';
import Bookmark from 'lucide-react-native/icons/bookmark';
import BookmarkCheck from 'lucide-react-native/icons/bookmark-check';
import Check from 'lucide-react-native/icons/check';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CircleHelp from 'lucide-react-native/icons/circle-question-mark';
import CircleParking from 'lucide-react-native/icons/circle-parking';
import Clock from 'lucide-react-native/icons/clock';
import Copy from 'lucide-react-native/icons/copy';
import Crosshair from 'lucide-react-native/icons/crosshair';
import DoorOpen from 'lucide-react-native/icons/door-open';
import ExternalLink from 'lucide-react-native/icons/external-link';
import MapPin from 'lucide-react-native/icons/map-pin';
import MessageSquare from 'lucide-react-native/icons/message-square';
import Search from 'lucide-react-native/icons/search';
import Share2 from 'lucide-react-native/icons/share-2';
import Star from 'lucide-react-native/icons/star';
import X from 'lucide-react-native/icons/x';
import { View } from 'react-native';

import type { IconName, IconProps } from './Icon.types';

const ICONS: Record<IconName, LucideIcon> = {
  search: Search,
  accessibility: Accessibility,
  mapPin: MapPin,
  clock: Clock,
  bookmark: Bookmark,
  bookmarkFilled: BookmarkCheck,
  elevator: ArrowUpDown,
  ramp: Accessibility,
  toilet: DoorOpen,
  parking: CircleParking,
  share: Share2,
  copy: Copy,
  check: Check,
  close: X,
  help: CircleHelp,
  externalLink: ExternalLink,
  messageSquare: MessageSquare,
  star: Star,
  chevronRight: ChevronRight,
  crosshair: Crosshair,
};

/**
 * 全 App Lucide 圖示的唯一入口（SDD ADR-16）。圖示一律是裝飾性的
 * （SDD §517：不得只靠圖示傳達資訊），所以包一層對輔助技術隱藏、
 * 不吃觸控的 `View`；意義由相鄰文字或外層元件的 `accessibilityLabel` 提供。
 */
export default function Icon({ name, size = 18, color, strokeWidth = 2 }: IconProps) {
  const Glyph = ICONS[name];
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <Glyph size={size} color={color} strokeWidth={strokeWidth} />
    </View>
  );
}
