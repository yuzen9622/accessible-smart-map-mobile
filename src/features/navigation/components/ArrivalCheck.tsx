import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { Icon } from '@/shared/ui';
import { MOTION } from '@/shared/theme/motion';

import type { IconProps } from '@/shared/ui';

/** 抵達的勾勾：從 0.9 倍放大到 1（不從 0 起跳）。降低動態時直接顯示。 */
export default function ArrivalCheck({ size, color }: Pick<IconProps, 'size' | 'color'>) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (!reduceMotion) progress.set(withTiming(1, MOTION.settle));
  }, [progress, reduceMotion]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: 0.9 + 0.1 * progress.get() }],
  }));

  return (
    <Animated.View style={animated}>
      <Icon name="circleCheck" size={size} color={color} />
    </Animated.View>
  );
}
