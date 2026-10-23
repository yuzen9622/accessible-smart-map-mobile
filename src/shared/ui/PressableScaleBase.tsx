import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { MOTION } from '@/shared/theme/motion';

import type { PressableScaleProps } from './PressableScale.types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function PressableScaleBase({
  feedback = 'scale',
  highlightColor = 'rgba(120,120,128,0.12)',
  style,
  onPressIn,
  onPressOut,
  ...props
}: PressableScaleProps) {
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() =>
    feedback === 'scale'
      ? { transform: [{ scale: 1 - 0.03 * pressed.value }] }
      : { backgroundColor: pressed.value > 0 ? highlightColor : 'transparent' },
  );

  return (
    <AnimatedPressable
      {...props}
      onPressIn={event => {
        pressed.value = withTiming(1, feedback === 'scale' ? MOTION.press : { duration: 0 });
        onPressIn?.(event);
      }}
      onPressOut={event => {
        pressed.value = withTiming(0, feedback === 'scale' ? MOTION.press : { duration: 200 });
        onPressOut?.(event);
      }}
      style={[style, animated]}
    />
  );
}
