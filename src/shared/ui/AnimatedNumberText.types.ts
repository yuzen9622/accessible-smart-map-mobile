import type { ColorValue } from 'react-native';

export type AnimatedNumberWeight = 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy';

export interface AnimatedNumberTextProps {
  /** 顯示文字（已格式化，例如 `formatDistance()` 的 "580 m"）；只有變動的字元會滾動。 */
  text: string;
  /** 文字背後的數值：決定滾動方向（變小＝往下數）；iOS 也用它觸發 SwiftUI 動畫。 */
  value: number;
  /** 點數，會再乘上系統字級（`fontScale`）。 */
  fontSize: number;
  fontWeight?: AnimatedNumberWeight;
  color: ColorValue;
  /** 螢幕閱讀器讀的文字；預設用 `text`。 */
  accessibilityLabel?: string;
}
