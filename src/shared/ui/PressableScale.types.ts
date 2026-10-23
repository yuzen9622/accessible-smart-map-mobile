import type { PressableProps, StyleProp, ViewStyle } from 'react-native';

export interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  /** `scale`：有邊界的物件；`highlight`：滿版列表列。 */
  feedback?: 'scale' | 'highlight';
  /** highlight 按下時的底色。 */
  highlightColor?: string;
  style?: StyleProp<ViewStyle>;
}
