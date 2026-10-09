// 逐一 deep import：Metro 不做 tree-shaking，從 `lucide-react-native` barrel 具名匯入會把
// 全部圖示打進 bundle（iOS bundle 實測 +2.3 MB）。型別匯入會在編譯時清除。
import type { LucideIcon } from 'lucide-react-native';
import Accessibility from 'lucide-react-native/icons/accessibility';
import Bookmark from 'lucide-react-native/icons/bookmark';
import BookmarkCheck from 'lucide-react-native/icons/bookmark-check';
import Check from 'lucide-react-native/icons/check';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import CircleHelp from 'lucide-react-native/icons/circle-question-mark';
import CircleParking from 'lucide-react-native/icons/circle-parking';
import Clock from 'lucide-react-native/icons/clock';
import Copy from 'lucide-react-native/icons/copy';
import Crosshair from 'lucide-react-native/icons/crosshair';
import ExternalLink from 'lucide-react-native/icons/external-link';
import MapPin from 'lucide-react-native/icons/map-pin';
import MessageSquare from 'lucide-react-native/icons/message-square';
import Search from 'lucide-react-native/icons/search';
import Share2 from 'lucide-react-native/icons/share-2';
import Star from 'lucide-react-native/icons/star';
import X from 'lucide-react-native/icons/x';
import ArrowDown from 'lucide-react-native/icons/arrow-down';
import ArrowUp from 'lucide-react-native/icons/arrow-up';
import ArrowUpDown from 'lucide-react-native/icons/arrow-up-down';
import ArrowUpLeft from 'lucide-react-native/icons/arrow-up-left';
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right';
import Bike from 'lucide-react-native/icons/bike';
import Bus from 'lucide-react-native/icons/bus';
import Car from 'lucide-react-native/icons/car';
import CornerUpLeft from 'lucide-react-native/icons/corner-up-left';
import CornerUpRight from 'lucide-react-native/icons/corner-up-right';
import Flag from 'lucide-react-native/icons/flag';
import Navigation from 'lucide-react-native/icons/navigation';
import Redo2 from 'lucide-react-native/icons/redo-2';
import SquareParking from 'lucide-react-native/icons/square-parking';
import TramFront from 'lucide-react-native/icons/tram-front';
import Toilet from 'lucide-react-native/icons/toilet';
import Undo2 from 'lucide-react-native/icons/undo-2';
import Footprints from 'lucide-react-native/icons/footprints';
import TrainFront from 'lucide-react-native/icons/train-front';
import TrainFrontTunnel from 'lucide-react-native/icons/train-front-tunnel';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import Construction from 'lucide-react-native/icons/construction';
import Cone from 'lucide-react-native/icons/cone';
import Volume2 from 'lucide-react-native/icons/volume-2';
import VolumeX from 'lucide-react-native/icons/volume-x';
import List from 'lucide-react-native/icons/list';
import Square from 'lucide-react-native/icons/square';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import LoaderCircle from 'lucide-react-native/icons/loader-circle';
import ArrowLeftRight from 'lucide-react-native/icons/arrow-left-right';
import Plus from 'lucide-react-native/icons/plus';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import Route from 'lucide-react-native/icons/route';
import RefreshCw from 'lucide-react-native/icons/refresh-cw';
import Info from 'lucide-react-native/icons/info';
import CircleX from 'lucide-react-native/icons/circle-x';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Timer from 'lucide-react-native/icons/timer';
import Phone from 'lucide-react-native/icons/phone';
import Siren from 'lucide-react-native/icons/siren';
import Users from 'lucide-react-native/icons/users';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import Camera from 'lucide-react-native/icons/camera';
import ImageIcon from 'lucide-react-native/icons/image';
import Settings from 'lucide-react-native/icons/settings';
import CircleUserRound from 'lucide-react-native/icons/circle-user-round';
import ThumbsUp from 'lucide-react-native/icons/thumbs-up';
import ThumbsDown from 'lucide-react-native/icons/thumbs-down';
import Trash from 'lucide-react-native/icons/trash';
import Pencil from 'lucide-react-native/icons/pencil';
import Megaphone from 'lucide-react-native/icons/megaphone';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import Heart from 'lucide-react-native/icons/heart';
import Hospital from 'lucide-react-native/icons/hospital';
import Mic from 'lucide-react-native/icons/mic';
import Utensils from 'lucide-react-native/icons/utensils';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Wind from 'lucide-react-native/icons/wind';
import Trees from 'lucide-react-native/icons/trees';
import Brain from 'lucide-react-native/icons/brain';
import AudioLines from 'lucide-react-native/icons/audio-lines';
import WifiOff from 'lucide-react-native/icons/wifi-off';
import Eye from 'lucide-react-native/icons/eye';
import PersonStanding from 'lucide-react-native/icons/person-standing';
import Baby from 'lucide-react-native/icons/baby';
import Type from 'lucide-react-native/icons/type';
import MapPinned from 'lucide-react-native/icons/map-pinned';
import ListFilter from 'lucide-react-native/icons/list-filter';
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
  toilet: Toilet,
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
  chevronLeft: ChevronLeft,
  crosshair: Crosshair,
  arrowDown: ArrowDown,
  arrowUp: ArrowUp,
  arrowUpDown: ArrowUpDown,
  arrowUpLeft: ArrowUpLeft,
  arrowUpRight: ArrowUpRight,
  bike: Bike,
  bus: Bus,
  car: Car,
  cornerUpLeft: CornerUpLeft,
  cornerUpRight: CornerUpRight,
  flag: Flag,
  navigation: Navigation,
  redo2: Redo2,
  squareParking: SquareParking,
  tramFront: TramFront,
  undo2: Undo2,
  footprints: Footprints,
  trainFront: TrainFront,
  trainFrontTunnel: TrainFrontTunnel,
  alert: TriangleAlert,
  construction: Construction,
  cone: Cone,
  volumeOn: Volume2,
  volumeOff: VolumeX,
  list: List,
  stop: Square,
  circleCheck: CircleCheck,
  loader: LoaderCircle,
  swap: ArrowLeftRight,
  plus: Plus,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  route: Route,
  refresh: RefreshCw,
  info: Info,
  circleX: CircleX,
  arrowLeft: ArrowLeft,
  timer: Timer,
  phone: Phone,
  siren: Siren,
  users: Users,
  shieldCheck: ShieldCheck,
  camera: Camera,
  image: ImageIcon,
  settings: Settings,
  user: CircleUserRound,
  thumbsUp: ThumbsUp,
  thumbsDown: ThumbsDown,
  trash: Trash,
  pencil: Pencil,
  megaphone: Megaphone,
  ellipsis: Ellipsis,
  heart: Heart,
  hospital: Hospital,
  mic: Mic,
  utensils: Utensils,
  sparkles: Sparkles,
  wind: Wind,
  trees: Trees,
  brain: Brain,
  audioLines: AudioLines,
  wifiOff: WifiOff,
  eye: Eye,
  personStanding: PersonStanding,
  baby: Baby,
  type: Type,
  mapPinned: MapPinned,
  listFilter: ListFilter,
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
