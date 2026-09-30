import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export interface ShimmerTextProps {
  children: string;
  active: boolean;
  color: string;
  highlight: string;
  style?: StyleProp<TextStyle>;
}

/** 對齊 Web `.thinking-shimmer` 的 1.4s 週期。 */
const PERIOD_MS = 1400;

/**
 * 「思考中…」的掃光文字（SDD §6.6 主案：Reanimated 動畫的漸層遮罩）。
 * 文字本身當遮罩，底下一條比文字寬三倍的漸層水平平移；`active` 為 false 或減少動態效果時是一般文字。
 * 無障礙：遮罩只影響繪製，外層 `Text` 仍是朗讀來源。
 */
export default function ShimmerText({ children, active, color, highlight, style }: ShimmerTextProps) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);
  const animate = active && !reduceMotion && width > 0;

  useEffect(() => {
    if (!animate) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration: PERIOD_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(progress);
  }, [animate, progress]);

  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: -2 * width + progress.value * 2 * width }] }));

  const onLayout = (event: LayoutChangeEvent) => setWidth(Math.ceil(event.nativeEvent.layout.width));

  if (!animate) {
    return (
      <Text style={[style, { color }]} onLayout={onLayout} numberOfLines={1}>
        {children}
      </Text>
    );
  }

  return (
    <MaskedView
      maskElement={
        <Text style={style} numberOfLines={1}>
          {children}
        </Text>
      }>
      {/* 撐出與文字一樣的尺寸；本身透明，只提供遮罩範圍與朗讀文字 */}
      <Text style={[style, styles.hidden]} onLayout={onLayout} numberOfLines={1}>
        {children}
      </Text>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: color }]} />
      <Animated.View style={[styles.band, { width: width * 3 }, sweep]}>
        <LinearGradient
          colors={[color, color, highlight, color, color]}
          locations={[0, 0.35, 0.5, 0.65, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
  band: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});
