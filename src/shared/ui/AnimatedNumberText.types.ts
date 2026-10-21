import type { ColorValue } from 'react-native';

export type AnimatedNumberWeight = 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy';

export interface AnimatedNumberTextProps {
  /** 顯示文字（已格式化，例如 `formatDistance()` 的 "580 m"）；只有變動的字元會滾動。 */
  text: string;
  /** 文字背後的數值：決定滾動方向（變小＝往下數）；iOS 也用它觸發 SwiftUI 動畫。 */
  value: number;
  /** 未縮放的設計點數，元件會套用 App 偏好與系統字級。 */
  fontSize: number;
  fontWeight?: AnimatedNumberWeight;
  /** true：固定在設計點數，不跟 App 偏好與系統字級放大（導航 HUD 這類一眼掃過的資訊）。 */
  fixedSize?: boolean;
  color: ColorValue;
  /** 螢幕閱讀器讀的文字；預設用 `text`。 */
  accessibilityLabel?: string;
}
