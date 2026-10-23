import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useSemanticColors, SHAPE } from '@/shared/theme';
import { AMBIENT_MS } from '@/shared/theme/motion';

const CARDS = [0, 1, 2];

/**
 * 算路中的骨架卡：形狀對齊 `RouteCard`（時間列、運具串、上車列），結果出現時版面不跳。
 * 淡入淡出只是「還在跑」的提示；系統開啟減少動態效果時保持靜止。
 */
export default function RouteSkeleton({ label }: { label: string }) {
  const semantic = useSemanticColors();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(withTiming(0.45, { duration: AMBIENT_MS / 2 }), -1, true);
  }, [pulse, reduceMotion]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const bar = { backgroundColor: semantic.neutral.bg };

  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={styles.list}>
      {CARDS.map((card) => (
        <Animated.View key={card} style={[styles.card, { backgroundColor: semantic.surface }, animated]}>
          <View style={styles.row}>
            <View style={[styles.bar, styles.duration, bar]} />
            <View style={[styles.bar, styles.journey, bar]} />
          </View>
          <View style={styles.chain}>
            <View style={[styles.bar, styles.pill, bar]} />
            <View style={[styles.bar, styles.pill, bar]} />
          </View>
          <View style={[styles.bar, styles.line, bar]} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  card: { borderRadius: SHAPE.card, borderCurve: 'continuous', padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  bar: { borderRadius: SHAPE.badge, borderCurve: 'continuous' },
  duration: { width: 96, height: 24 },
  journey: { width: 88, height: 14 },
  chain: { flexDirection: 'row', gap: 8 },
  pill: { width: 56, height: 22 },
  line: { width: '70%', height: 14 },
});
