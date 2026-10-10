import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  useReducedMotion,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';

import type { AnimatedNumberTextProps } from './AnimatedNumberText.types';
import { RN_FONT_WEIGHT } from './animatedNumberWeight';
import { useFontScale } from '@/shared/preferences/useFontScale';

const DURATION = 220;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/** 從 `offset`（px，正＝下方）滾進定位。 */
function rollIn(offset: number): EntryExitAnimationFunction {
  return () => {
    'worklet';
    const config = { duration: DURATION, easing: EASE_OUT };
    return {
      initialValues: { opacity: 0, transform: [{ translateY: offset }] },
      animations: { opacity: withTiming(1, config), transform: [{ translateY: withTiming(0, config) }] },
    };
  };
}

/** 從定位滾往 `offset` 並淡出（給「舊字元」當 entering 用）。 */
function rollAway(offset: number): EntryExitAnimationFunction {
  return () => {
    'worklet';
    const config = { duration: DURATION, easing: EASE_OUT };
    return {
      initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
      animations: { opacity: withTiming(0, config), transform: [{ translateY: withTiming(offset, config) }] },
    };
  };
}

function fadeAway(): EntryExitAnimationFunction {
  return () => {
    'worklet';
    return { initialValues: { opacity: 1 }, animations: { opacity: withTiming(0, { duration: DURATION }) } };
  };
}

interface SlotProps {
  char: string;
  down: boolean;
  travel: number;
  reduced: boolean;
  textStyle: TextStyle;
}

/**
 * 一個字元格。字元變動時，舊字元與新字元在同一次 render 各自以 `entering` 掛載
 * （舊的滾走、新的滾進），兩者都拿到當下的方向；不用 `exiting`，因為被移除的元素
 * 只會帶著上一次 render 的 props，方向會晚一拍。
 */
function Slot({ char, down, travel, reduced, textStyle }: SlotProps) {
  const [slot, setSlot] = useState<{ char: string; prevChar: string | null; gen: number }>({ char, prevChar: null, gen: 0 });
  if (char !== slot.char) setSlot({ char, prevChar: slot.char, gen: slot.gen + 1 });

  const dir = down ? -1 : 1;
  return (
    <View importantForAccessibility="no-hide-descendants">
      {slot.prevChar !== null ? (
        <Animated.Text
          key={`out-${slot.gen}`}
          entering={reduced ? fadeAway() : rollAway(-travel * dir)}
          style={[styles.char, textStyle, styles.overlay]}>
          {slot.prevChar}
        </Animated.Text>
      ) : null}
      <Animated.Text
        key={`in-${slot.gen}`}
        entering={reduced ? FadeIn.duration(DURATION) : rollIn(travel * dir)}
        style={[styles.char, textStyle]}>
        {slot.char}
      </Animated.Text>
    </View>
  );
}

/**
 * Android：Reanimated 逐字元滾動（對應 iOS 的 SwiftUI numericText）。
 * 字元格以「從右數第幾位」當 key，只有變動的那一位會滾；數值變大往上滾、變小往下滾。
 * 「減少動態效果」時只淡入淡出，不位移。首次掛載不播動畫。
 */
export default function AnimatedNumberText({ text, value, fontSize, fontWeight = 'bold', color, accessibilityLabel }: AnimatedNumberTextProps) {
  const { fontScale } = useWindowDimensions();
  const appScale = useFontScale();
  const reduced = useReducedMotion();
  const [prev, setPrev] = useState(value);
  const [countsDown, setCountsDown] = useState(false);
  if (!Object.is(value, prev)) {
    setPrev(value);
    setCountsDown(value < prev);
  }

  const travel = fontSize * appScale * fontScale * 0.8;
  const chars = Array.from(text);
  const textStyle: TextStyle = { fontSize: fontSize * appScale, fontWeight: RN_FONT_WEIGHT[fontWeight], color };

  return (
    <View accessible accessibilityLabel={accessibilityLabel ?? text} style={styles.row}>
      <LayoutAnimationConfig skipEntering>
        {chars.map((char, index) => (
          <Animated.View key={chars.length - index} exiting={FadeOut.duration(DURATION)}>
            <Slot char={char} down={countsDown} travel={travel} reduced={reduced} textStyle={textStyle} />
          </Animated.View>
        ))}
      </LayoutAnimationConfig>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignSelf: 'flex-start', overflow: 'hidden' },
  char: { fontVariant: ['tabular-nums'] },
  overlay: { position: 'absolute', left: 0, top: 0 },
});
