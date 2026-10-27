import { GlassView } from 'expo-glass-effect';
import { StyleSheet, View } from 'react-native';

import { useThemeColors, SHAPE, ELEVATION } from '@/shared/theme';
import { usePreferencesStore } from '@/shared/preferences/preferencesStore';

import type { GlassCardProps } from './GlassCard.types';
import { useLiquidGlass } from './useLiquidGlass';

/**
 * 地圖上疊的卡片（HUD、pill）：iOS 26+ 用 Liquid Glass；不支援或使用者開「降低透明度」時
 * 退回不透明底色（SDD §4.5 原則）。
 */
export default function GlassCard({ children, style, interactive = false }: GlassCardProps) {
  const colors = useThemeColors();
  const highContrast = usePreferencesStore(s => s.highContrast);
  const liquidGlass = useLiquidGlass();

  if (!liquidGlass) {
    return <View style={[styles.card, styles.opaque, { backgroundColor: colors.background }, style,
      highContrast && { backgroundColor: colors.background, borderColor: colors.textSecondary, borderWidth: 1 },
    ]}>{children}</View>;
  }
  return (
    <GlassView glassEffectStyle="regular" isInteractive={interactive} style={[styles.card, style]}>
      {children}
    </GlassView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: SHAPE.floating, borderCurve: 'continuous', overflow: 'hidden' },
  opaque: {
    overflow: 'visible',
    boxShadow: ELEVATION.floating,
  },
});
