import { StyleSheet } from 'react-native';

import { useSemanticColors, SHAPE } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import type { ShareButtonProps } from './ShareButton.types';
import PressableScale from '@/shared/ui/PressableScale';

/** Android／fallback：RN `Share`（`onShare`）＋ Lucide `Share2` 的圖示圓鈕（與 iOS 同樣式）。 */
export default function ShareButton({ label, onShare }: ShareButtonProps) {
  const tones = useSemanticColors();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onShare}
      style={[styles.circle, { backgroundColor: tones.accentSoft }]}>
      <Icon name="share" size={20} color={tones.accent} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  circle: { width: 50, height: 50, borderRadius: SHAPE.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
});
