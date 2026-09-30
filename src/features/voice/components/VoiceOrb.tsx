import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/shared/ui';

import { isMicActiveStatus } from '../domain/audioLevel';
import type { VoiceStatusName } from '../domain/voiceSession';

export interface VoiceOrbProps {
  status: VoiceStatusName;
  micLevel: number;
  color: string;
  size?: number;
}

/**
 * 語音模式的狀態球（對應 Web `VoiceModeView` 的 64px ThinkingOrb；thinking-orbs 是 canvas，不移植）：
 * 聆聽時外圈隨麥克風音量放大，模型回覆時慢速呼吸，連線／重連時淡入淡出。減少動態效果時全部靜止。
 */
export default function VoiceOrb({ status, micLevel, color, size = 96 }: VoiceOrbProps) {
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(0);
  const level = useSharedValue(0);
  const speaking = status === 'model-speaking';
  const waiting = status === 'connecting' || status === 'reconnecting';

  useEffect(() => {
    level.value = reduceMotion || !isMicActiveStatus(status) ? 0 : withSpring(Math.min(Math.max(micLevel, 0), 1), { damping: 14 });
  }, [level, micLevel, reduceMotion, status]);

  useEffect(() => {
    if (reduceMotion || (!speaking && !waiting)) {
      cancelAnimation(breath);
      breath.value = 0;
      return;
    }
    const duration = speaking ? 900 : 700;
    breath.value = withRepeat(withSequence(withTiming(1, { duration }), withTiming(0, { duration })), -1, false);
    return () => cancelAnimation(breath);
  }, [breath, reduceMotion, speaking, waiting]);

  const halo = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + level.value * 0.45 + breath.value * 0.12 }],
    opacity: waiting ? 0.25 + breath.value * 0.35 : 0.28 + level.value * 0.3,
  }));

  return (
    <View style={[styles.root, { width: size * 1.6, height: size * 1.6 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.halo, { width: size * 1.4, height: size * 1.4, borderRadius: size * 0.7, backgroundColor: color }, halo]} />
      <View style={[styles.core, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
        <Icon name={speaking ? 'audioLines' : 'mic'} size={size * 0.4} color="#FFFFFF" strokeWidth={2.2} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute' },
  core: { alignItems: 'center', justifyContent: 'center' },
});
