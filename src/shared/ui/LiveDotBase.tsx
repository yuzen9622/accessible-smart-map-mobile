import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { LIVE_DOT, SHAPE } from '@/shared/theme';
import { AMBIENT_MS, MOTION } from '@/shared/theme/motion';

import type { LiveDotProps } from './LiveDot.types';

/** 「即時」小圓點：以 `AMBIENT_MS` 呼吸（opacity 1 → 0.35）。降低動態時維持靜態圓點。 */
export default function LiveDotBase({ size = 8, color = LIVE_DOT }: LiveDotProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(opacity);
      opacity.set(1);
      return;
    }
    opacity.set(withRepeat(withTiming(0.35, { duration: AMBIENT_MS / 2, easing: MOTION.medium.easing }), -1, true));
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.dot, { width: size, height: size, backgroundColor: color }, animated]}
    />
  );
}

const styles = StyleSheet.create({
  dot: { borderRadius: SHAPE.pill, borderCurve: 'continuous' },
});
