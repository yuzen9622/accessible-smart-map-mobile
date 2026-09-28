export type IconName =
  | 'search'
  | 'accessibility'
  | 'mapPin'
  | 'clock'
  | 'bookmark'
  | 'bookmarkFilled'
  | 'elevator'
  | 'ramp'
  | 'toilet'
  | 'parking'
  | 'share'
  | 'copy'
  | 'check'
  | 'close'
  | 'help'
  | 'externalLink'
  | 'messageSquare'
  | 'star'
  | 'chevronRight'
  | 'crosshair';

export interface IconProps {
  name: IconName;
  /** 預設 18 */
  size?: number;
  /** 必填：由呼叫端傳 theme／palette 色 */
  color: string;
  /** 預設 2 */
  strokeWidth?: number;
}
