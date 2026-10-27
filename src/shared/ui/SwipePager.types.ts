import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface SwipePagerProps {
  /** 目前選中的頁（對應上方 SegmentedControl 的順序）。 */
  index: number;
  /** 每頁內容；全部同時渲染，滑動時相鄰頁跟著手指一起出現。 */
  pages: readonly ReactNode[];
  /** 頁面吸附停好後回報新頁（拖動途中不回報，避免畫面在手指下換內容）。 */
  onIndexChange: (index: number) => void;
  style?: StyleProp<ViewStyle>;
}
