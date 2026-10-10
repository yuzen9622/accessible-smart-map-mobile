import { Text } from '@/shared/ui/typography/Text';


import type { AnimatedNumberTextProps } from './AnimatedNumberText.types';
import { RN_FONT_WEIGHT } from './animatedNumberWeight';

/** Fallback（web／型別解析）：不做動畫，直接顯示文字。 */
export default function AnimatedNumberText({ text, fontSize, fontWeight = 'bold', color, accessibilityLabel }: AnimatedNumberTextProps) {
  return (
    <Text
      accessibilityLabel={accessibilityLabel ?? text}
      style={{ fontSize, fontWeight: RN_FONT_WEIGHT[fontWeight], color, fontVariant: ['tabular-nums'] }}>
      {text}
    </Text>
  );
}
