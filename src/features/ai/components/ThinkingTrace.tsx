import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  ZoomIn,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useAppTranslation } from '@/shared/i18n';
import { useFontScale } from '@/shared/preferences';
import { TYPE, scaledSize, semanticColors, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import type { ThinkingHeader, TraceRow } from '../domain/thinkingTrace';
import ShimmerText from './ShimmerText';

export interface ThinkingTraceProps {
  rows: TraceRow[];
  header: ThinkingHeader;
  isDark: boolean;
}

const EASE = Easing.bezier(0.23, 1, 0.32, 1);

/** 執行中的 Sparkles：慢速呼吸＋微旋轉（SDD §6.6；Web 的 thinking-orbs 是 canvas，不移植）。 */
function WorkingGlyph({ color }: { color: string }) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })), -1, false);
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.6 + pulse.value * 0.4,
    transform: [{ scale: 0.9 + pulse.value * 0.15 }, { rotate: `${pulse.value * 18}deg` }],
  }));
  return (
    <Animated.View style={style}>
      <Icon name="sparkles" size={16} color={color} />
    </Animated.View>
  );
}

function Spinner({ color }: { color: string }) {
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    turn.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(turn);
  }, [turn, reduceMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  return (
    <Animated.View style={style}>
      <Icon name="loader" size={14} color={color} />
    </Animated.View>
  );
}

/**
 * 工具呼叫時間軸（對齊 Web `components/ai/ThinkingTrace.tsx`）：header＝狀態圖示＋掃光文字＋展開箭頭；
 * 執行中自動展開、完成後收合，使用者點過之後以使用者的選擇為準。展開後是左側細線串起的工具列。
 * 判斷邏輯（文字、working、row）全在 `domain/thinkingTrace.ts`，這裡只畫。
 */
export default function ThinkingTrace({ rows, header, isDark }: ThinkingTraceProps) {
  const { t } = useAppTranslation();
  const colors = useThemeColors();
  const tones = semanticColors(isDark);
  const fontScale = useFontScale();
  const reduceMotion = useReducedMotion();
  // 三態：null＝跟隨自動規則；使用者點過就固定成他選的
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const expanded = rows.length > 0 && (manualExpanded ?? header.working);
  const layout = reduceMotion ? undefined : LinearTransition.duration(320).easing(EASE);

  return (
    <Animated.View layout={layout} style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={header.label}
        accessibilityState={{ expanded, disabled: rows.length === 0 }}
        accessibilityHint={rows.length > 0 ? t('nativeAiTraceToggleHint') : undefined}
        disabled={rows.length === 0}
        onPress={() => setManualExpanded((current) => !(current ?? header.working))}
        hitSlop={6}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
        {header.working ? <WorkingGlyph color={tones.accent} /> : <Icon name="sparkles" size={16} color={colors.textSecondary} />}
        <View accessibilityLiveRegion="polite" style={styles.headerText}>
          <ShimmerText
            active={header.working}
            color={colors.textSecondary}
            highlight={colors.text}
            style={[styles.headerLabel, { fontSize: scaledSize(TYPE.subhead, fontScale) }]}>
            {header.label}
          </ShimmerText>
        </View>
        {rows.length > 0 ? <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={14} color={colors.textSecondary} /> : null}
      </Pressable>

      {expanded ? (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(260).easing(EASE)}
          exiting={reduceMotion ? undefined : FadeOut.duration(160)}
          style={styles.timeline}>
          <View style={[styles.rail, { backgroundColor: tones.separator }]} />
          {rows.map((row, index) => (
            <Animated.View
              key={row.id}
              entering={reduceMotion ? undefined : FadeIn.duration(320).delay(Math.min(index, 6) * 90)}
              layout={layout}
              accessible
              accessibilityLabel={`${row.label}${row.detail ? `，${row.detail}` : ''}，${
                row.status === 'running' ? t('nativeAiTraceRunning') : t('nativeAiTraceDone')
              }`}
              style={styles.row}>
              <View style={styles.rowIcon}>
                {row.status === 'running' ? (
                  <Spinner color={colors.textSecondary} />
                ) : (
                  <Animated.View entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)}>
                    <Icon name="check" size={14} color={tones.ok.fg} />
                  </Animated.View>
                )}
              </View>
              <Text
                numberOfLines={1}
                style={[styles.rowLabel, { color: colors.text, fontSize: scaledSize(TYPE.subhead, fontScale) }]}>
                {row.label}
              </Text>
              {row.detail ? (
                <Text
                  numberOfLines={1}
                  style={[styles.rowDetail, { color: colors.textSecondary, fontSize: scaledSize(TYPE.caption, fontScale) }]}>
                  {row.detail}
                </Text>
              ) : null}
            </Animated.View>
          ))}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', marginBottom: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 4, minHeight: 32 },
  headerText: { flexShrink: 1 },
  headerLabel: { fontWeight: '600' },
  pressed: { opacity: 0.6 },
  timeline: { marginLeft: 7, paddingLeft: 16, paddingVertical: 2, gap: 2 },
  rail: { position: 'absolute', left: 0, top: 0, bottom: 8, width: StyleSheet.hairlineWidth * 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  rowIcon: { width: 16, alignItems: 'center' },
  rowLabel: { fontWeight: '500', flexShrink: 1 },
  // 空間不夠時先犧牲補充說明，保住工具名稱（對齊 Web shrink-[3]）
  rowDetail: { flexShrink: 3 },
});
