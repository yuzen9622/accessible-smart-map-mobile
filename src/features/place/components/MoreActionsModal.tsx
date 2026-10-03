import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_FONT_SCALE, MIN_TOUCH, RADIUS, TYPE, useSemanticColors, useThemeColors } from '@/shared/theme';
import { Icon } from '@/shared/ui';

import type { MoreActionsButtonProps } from './MoreActionsButton.types';

/**
 * 地點動作列的「⋯」：非原生平台 fallback，以底部 Modal 列出次要動作。
 * 不用 `Alert.alert`：Android 對話框最多 3 顆按鈕，動作（回到此地點、複製、OSM、Google）加取消會被截掉，
 * 且預設點外面關不掉。這裡點背景、返回鍵、取消都能關閉，動作數量不受限。
 */
export default function MoreActionsModal({ label, cancelLabel, actions, backgroundColor, color }: MoreActionsButtonProps) {
  const [open, setOpen] = useState(false);
  const colors = useThemeColors();
  const semantic = useSemanticColors();
  const insets = useSafeAreaInsets();
  const close = () => setOpen(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        android_ripple={{ borderless: true }}
        style={({ pressed }) => [styles.button, { backgroundColor }, pressed && styles.pressed]}>
        <Icon name="ellipsis" size={20} color={color} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <Pressable accessibilityRole="button" accessibilityLabel={cancelLabel} onPress={close} style={styles.backdrop} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View accessibilityViewIsModal style={[styles.group, { backgroundColor: colors.background }]}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.title, { color: colors.textSecondary }]}>
              {label}
            </Text>
            {actions.map((action) => (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                onPress={() => {
                  close();
                  action.onPress();
                }}
                android_ripple={{ color: semantic.separator }}
                style={({ pressed }) => [styles.row, { borderColor: semantic.separator }, pressed && styles.pressed]}>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.rowText, { color: semantic.accent }]}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={close}
            android_ripple={{ color: semantic.separator }}
            style={({ pressed }) => [styles.group, styles.cancel, { backgroundColor: colors.background }, pressed && styles.pressed]}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.rowText, styles.cancelText, { color: colors.text }]}>{cancelLabel}</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, gap: 8 },
  group: { borderRadius: RADIUS.card, overflow: 'hidden' },
  title: { fontSize: TYPE.subhead, fontWeight: '600', textAlign: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  row: { minHeight: MIN_TOUCH + 8, justifyContent: 'center', paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth },
  rowText: { fontSize: TYPE.body, textAlign: 'center' },
  cancel: { minHeight: MIN_TOUCH + 8, justifyContent: 'center' },
  cancelText: { fontWeight: '600' },
});
