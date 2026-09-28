import { Pressable, StyleSheet, Text, useColorScheme } from 'react-native';

import { Icon } from '@/shared/ui';

import { PLACE_ACCENT_COLOR, PLACE_ACCENT_COLOR_DARK, PLACE_BORDER_COLOR } from './palette';
import type { ShareButtonProps } from './ShareButton.types';

/** Android／fallback：RN `Share`（`onShare`）＋ Lucide `Share2` 的 pill。 */
export default function ShareButton({ label, onShare }: ShareButtonProps) {
  const accentText = useColorScheme() === 'dark' ? PLACE_ACCENT_COLOR_DARK : PLACE_ACCENT_COLOR;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onShare} style={styles.pill}>
      <Icon name="share" color={accentText} />
      <Text style={[styles.label, { color: accentText }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PLACE_BORDER_COLOR,
    paddingHorizontal: 14,
  },
  label: { fontSize: 15, fontWeight: '600' },
});
