import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, type PressableStateCallbackType } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { MOTION } from '@/shared/theme/motion';

import type { PressableScaleProps } from './PressableScale.types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const PRESSED_SCALE = 0.97;
const REDUCED_MOTION_OPACITY = 0.7;

export default function PressableScaleBase({
  feedback = 'scale',
  highlightColor = 'rgba(120,120,128,0.14)',
  style,
  children,
  ref,
  onPressIn,
  onPressOut,
  ...props
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [pressed, setPressed] = useState(false);
  const trackPressed = typeof style === 'function' || typeof children === 'function';

  const feedbackStyle = useAnimatedStyle(() => {
    if (feedback !== 'scale') return {};
    return reduceMotion
      ? { opacity: 1 - (1 - REDUCED_MOTION_OPACITY) * progress.value }
      : { transform: [{ scale: 1 - (1 - PRESSED_SCALE) * progress.value }] };
  });
  const overlayStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  const resolvedStyle = typeof style === 'function' ? style({ pressed, hovered: false }) : style;
  const radius = StyleSheet.flatten(resolvedStyle)?.borderRadius;
  const overlay =
    feedback === 'highlight' ? (
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: highlightColor, borderRadius: radius, borderCurve: 'continuous' }, overlayStyle]}
      />
    ) : null;

  const content =
    typeof children === 'function'
      ? (state: PressableStateCallbackType): ReactNode => (
          <>
            {children(state)}
            {overlay}
          </>
        )
      : (
          <>
            {children}
            {overlay}
          </>
        );

  return (
    <AnimatedPressable
      {...props}
      ref={ref}
      onPressIn={event => {
        progress.set(withTiming(1, feedback === 'scale' ? MOTION.press : { duration: 0 }));
        if (trackPressed) setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={event => {
        progress.set(withTiming(0, feedback === 'scale' ? MOTION.press : MOTION.small));
        if (trackPressed) setPressed(false);
        onPressOut?.(event);
      }}
      style={[resolvedStyle, feedbackStyle]}
    >
      {content}
    </AnimatedPressable>
  );
}
