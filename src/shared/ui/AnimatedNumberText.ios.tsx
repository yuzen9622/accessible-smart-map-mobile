import { Host, Text } from '@expo/ui/swift-ui';
import {
  Animation,
  accessibilityLabel as a11yLabel,
  animation,
  contentTransition,
  font,
  foregroundStyle,
  lineLimit,
  monospacedDigit,
} from '@expo/ui/swift-ui/modifiers';
import { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import type { AnimatedNumberTextProps } from './AnimatedNumberText.types';

/**
 * iOS：SwiftUI `Text` + `.contentTransition(.numericText(countsDown:))`，系統原生的數字滾動。
 * 開「減少動態效果」時改成淡入淡出（`.opacity`），仍保留「數字變了」的提示。
 */
export default function AnimatedNumberText({ text, value, fontSize, fontWeight = 'bold', color, accessibilityLabel }: AnimatedNumberTextProps) {
  const { fontScale } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [prev, setPrev] = useState(value);
  const [countsDown, setCountsDown] = useState(false);
  if (!Object.is(value, prev)) {
    setPrev(value);
    setCountsDown(value < prev);
  }

  return (
    <Host matchContents>
      <Text
        modifiers={[
          font({ size: fontSize * fontScale, weight: fontWeight }),
          monospacedDigit(),
          foregroundStyle(color),
          lineLimit(1),
          reduced ? contentTransition('opacity') : contentTransition('numericText', { countsDown }),
          animation(Animation.easeOut({ duration: 0.25 }), value),
          a11yLabel(accessibilityLabel ?? text),
        ]}>
        {text}
      </Text>
    </Host>
  );
}
