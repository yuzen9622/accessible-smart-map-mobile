import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { useThemeColors } from '@/shared/theme';

import type { GlassCardProps } from './GlassCard.types';

/**
 * 地圖上疊的卡片（HUD、pill）：iOS 26+ 用 Liquid Glass；不支援或使用者開「降低透明度」時
 * 退回不透明底色（SDD §4.5 原則）。
 */
export default function GlassCard({ children, style, interactive = false }: GlassCardProps) {
  const colors = useThemeColors();
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const enabled = await AccessibilityInfo.isReduceTransparencyEnabled();
        if (active) setReduceTransparency(enabled);
      } catch {
        // 讀不到就維持玻璃效果
      }
    };
    void load();
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  if (!isLiquidGlassAvailable() || reduceTransparency) {
    return <View style={[styles.card, styles.opaque, { backgroundColor: colors.background }, style]}>{children}</View>;
  }
  return (
    <GlassView glassEffectStyle="regular" isInteractive={interactive} style={[styles.card, style]}>
      {children}
    </GlassView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, overflow: 'hidden' },
  opaque: {
    overflow: 'visible',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
});
