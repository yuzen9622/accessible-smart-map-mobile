import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface GlassCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 可點的玻璃（按下有互動回饋）；預設 false。 */
  interactive?: boolean;
}
