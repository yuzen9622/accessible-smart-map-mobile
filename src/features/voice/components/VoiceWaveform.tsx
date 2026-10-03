import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { WaveformMode } from '../domain/audioLevel';

export interface VoiceWaveformProps {
  /**
   * 驅動音波的音量 [0, 1]（`voiceLevelFor(waveformLevelSource(...))`：聆聽時是麥克風、AI 說話時是播放；
   * `null` 視為 0）。用 SharedValue 在 UI thread 直接讀，音量變化不觸發 React 重繪。
   */
  level: SharedValue<number> | null;
  mode: WaveformMode;
  /** 中央直條的顏色；兩側漸淡成 `edgeColor`。 */
  color: string;
  edgeColor: string;
  height: number;
  barCount?: number;
  barWidth?: number;
  gap?: number;
  /**
   * 開場長出來的進度（0 → 1）：直條由中央往兩側依序長高。由呼叫端驅動（過場動畫）；不給就直接完整顯示。
   */
  reveal?: SharedValue<number>;
}

const TAU = Math.PI * 2;
/** 待機（連線中）時的固定幅度。 */
const IDLE_AMPLITUDE = 0.14;
/** live 但沒聲音時保留一點起伏，讓人知道還在聽。 */
const LIVE_FLOOR = 0.05;
const AMPLITUDE_SPRING = { damping: 16, stiffness: 220, mass: 0.6 } as const;

/**
 * 上下對稱的圓角直條音波。幅度跟著真實音量（spring 平滑），每根直條再疊兩個不同頻率、錯開相位的正弦，
 * 所以音量固定時也像聲音在流動；中央高、兩側低（sin 包絡）。全部在 UI thread 跑。
 * 減少動態效果時不跑時鐘，直條停在固定的波形輪廓上，只隨音量改變高度。
 */
export default function VoiceWaveform({
  level,
  mode,
  color,
  edgeColor,
  height,
  barCount = 36,
  barWidth = 5,
  gap = 4,
  reveal,
}: VoiceWaveformProps) {
  const reduceMotion = useReducedMotion();
  const clock = useSharedValue(0);
  const amplitude = useSharedValue(0);

  useAnimatedReaction(
    () => {
      const raw = level ? level.value : 0;
      const current = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0;
      return mode === 'flat' ? 0 : mode === 'idle' ? IDLE_AMPLITUDE : Math.max(current, LIVE_FLOOR);
    },
    (target, previous) => {
      if (target === previous) return;
      amplitude.set(reduceMotion ? target : withSpring(target, AMPLITUDE_SPRING));
    },
    [level, mode, reduceMotion],
  );

  useEffect(() => {
    if (reduceMotion || mode === 'flat') {
      cancelAnimation(clock);
      return;
    }
    // 待機時慢、說話時快一點；從當下的相位接著走，換模式時不跳
    const duration = mode === 'idle' ? 2600 : 1400;
    clock.set(withRepeat(withTiming(clock.get() + 1, { duration, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(clock);
  }, [clock, mode, reduceMotion]);

  const bars = Array.from({ length: barCount }, (_, index) => index);
  const center = (barCount - 1) / 2;

  return (
    <View
      style={[styles.row, { height, gap }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {bars.map((index) => {
        const distance = center === 0 ? 0 : Math.abs(index - center) / center;
        return (
          <WaveBar
            key={index}
            index={index}
            distance={distance}
            height={height}
            width={barWidth}
            color={interpolateColor(distance, [0, 1], [color, edgeColor])}
            clock={clock}
            amplitude={amplitude}
            reveal={reveal}
          />
        );
      })}
    </View>
  );
}

function WaveBar({
  index,
  distance,
  height,
  width,
  color,
  clock,
  amplitude,
  reveal,
}: {
  index: number;
  distance: number;
  height: number;
  width: number;
  color: string;
  clock: SharedValue<number>;
  amplitude: SharedValue<number>;
  reveal: SharedValue<number> | undefined;
}) {
  // 中央高、兩側低；最外側仍保留 30%，看起來是一整條波而不是一個尖峰
  const envelope = 0.3 + 0.7 * Math.cos((distance * Math.PI) / 2);

  const style = useAnimatedStyle(() => {
    const t = clock.value * TAU;
    const wiggle = 0.62 + 0.24 * Math.sin(t * 2 + index * 0.62) + 0.14 * Math.sin(t * 3 - index * 1.27);
    const energy = Math.min(1, amplitude.value * 1.5);
    const grown = reveal ? Math.min(1, Math.max(0, (reveal.value * 1.6 - distance) / 0.6)) : 1;
    const barHeight = width + (height - width) * energy * envelope * wiggle * grown;
    return { height: barHeight, opacity: reveal ? Math.min(1, grown * 2) : 1 };
  });

  return <Animated.View style={[{ width, borderRadius: width / 2, backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
