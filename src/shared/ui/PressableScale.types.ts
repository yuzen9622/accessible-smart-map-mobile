import type { Ref } from 'react';
import type { PressableProps, View } from 'react-native';

export interface PressableScaleProps extends PressableProps {
  ref?: Ref<View>;
  /** `scale`：有邊界的物件（按鈕、卡片、chip）；`highlight`：滿版列表列。 */
  feedback?: 'scale' | 'highlight';
  /** highlight 按下時的底色。 */
  highlightColor?: string;
}
