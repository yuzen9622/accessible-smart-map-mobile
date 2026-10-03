import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useAppTranslation } from '@/shared/i18n';
import { RADIUS, useSemanticColors, useThemeColors } from '@/shared/theme';

/**
 * 地點詳情載入中的骨架：版型對齊 `PlaceDetailView`（標題、副標、動作列、無障礙卡、附近設施），
 * 載入完成時畫面不會跳動。整塊對 VoiceOver 只念一次「載入中」。減少動態效果時不做呼吸動畫。
 */
export default function PlaceDetailSkeleton({ label }: { label?: string }) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  // 用 surface（半透明灰）而不是 backgroundElement：後者在白底只有約 1.1:1，脈動時幾乎消失
  const surface = useSemanticColors().surface;
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(withTiming(0.6, { duration: 800 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const block = { backgroundColor: surface };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      scrollEnabled={false}>
      <Animated.View
        accessible
        accessibilityLabel={label ?? t('loading')}
        accessibilityRole="progressbar"
        accessibilityState={{ busy: true }}
        style={[styles.stack, pulse]}>
        <View style={styles.header}>
          <View style={[styles.line, styles.title, block]} />
          <View style={[styles.line, styles.subtitle, block]} />
          <View style={styles.badges}>
            <View style={[styles.badge, block]} />
            <View style={[styles.badge, block]} />
          </View>
        </View>
        <View style={styles.actions}>
          <View style={[styles.primary, block]} />
          <View style={[styles.circle, block]} />
          <View style={[styles.circle, block]} />
          <View style={[styles.circle, block]} />
        </View>
        <View style={styles.section}>
          <View style={[styles.line, styles.heading, block]} />
          <View style={[styles.card, styles.checklist, block]} />
        </View>
        <View style={styles.section}>
          <View style={[styles.line, styles.heading, block]} />
          <View style={[styles.card, styles.list, block]} />
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  stack: { gap: 24 },
  header: { gap: 10 },
  line: { borderRadius: 6 },
  title: { width: '60%', height: 26 },
  subtitle: { width: '85%', height: 15 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badge: { width: 64, height: 26, borderRadius: RADIUS.pill },
  actions: { flexDirection: 'row', gap: 8, marginTop: -8 },
  primary: { flex: 1, height: 50, borderRadius: RADIUS.pill },
  circle: { width: 50, height: 50, borderRadius: RADIUS.pill },
  section: { gap: 10 },
  heading: { width: 140, height: 20 },
  card: { borderRadius: RADIUS.card },
  checklist: { height: 112 },
  list: { height: 180 },
});
