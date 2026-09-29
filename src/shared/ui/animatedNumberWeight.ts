import type { TextStyle } from 'react-native';

import type { AnimatedNumberWeight } from './AnimatedNumberText.types';

export const RN_FONT_WEIGHT: Record<AnimatedNumberWeight, NonNullable<TextStyle['fontWeight']>> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
};
