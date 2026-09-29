import { Pressable, StyleSheet, useColorScheme } from 'react-native';

import { RADIUS, semanticColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import type { ShareButtonProps } from './ShareButton.types';

/** Android／fallback：RN `Share`（`onShare`）＋ Lucide `Share2` 的圖示圓鈕（與 iOS 同樣式）。 */
export default function ShareButton({ label, onShare }: ShareButtonProps) {
  const tones = semanticColors(useColorScheme() === 'dark');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onShare}
      style={({ pressed }) => [styles.circle, { backgroundColor: tones.surface }, pressed && styles.pressed]}>
      <Icon name="share" color={tones.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: { width: 44, height: 44, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
