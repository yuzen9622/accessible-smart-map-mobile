import { Text } from '@/shared/ui/typography/Text';
import { useState } from 'react';
import { Modal, StyleSheet, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_FONT_SCALE, MIN_TOUCH, TYPE, useSemanticColors, useThemeColors, SHAPE, ICON_SIZE } from '@/shared/theme';
import Icon from '../Icon';

import type { MoreActionsButtonProps } from './MoreActionsButton.types';
import PressableScale from '@/shared/ui/PressableScale';

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
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={[styles.button, { backgroundColor }]}>
        <Icon name="ellipsis" size={ICON_SIZE.control} color={color} />
      </PressableScale>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
        <Pressable accessibilityRole="button" accessibilityLabel={cancelLabel} onPress={close} style={styles.backdrop} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View accessibilityViewIsModal style={[styles.group, { backgroundColor: colors.background }]}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE.label} style={[styles.title, { color: colors.textSecondary }]}>
              {label}
            </Text>
            {actions.map((action) => (
              <PressableScale
                key={action.label}
                accessibilityRole="button"
                onPress={() => {
                  close();
                  action.onPress();
                }}
                feedback="highlight"
                style={[styles.row, { borderColor: semantic.separator }]}>
                <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.rowText, { color: semantic.accent }]}>{action.label}</Text>
              </PressableScale>
            ))}
          </View>
          <PressableScale
            accessibilityRole="button"
            onPress={close}
            feedback="highlight"
            style={[styles.group, styles.cancel, { backgroundColor: colors.background }]}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE.body} style={[styles.rowText, styles.cancelText, { color: colors.text }]}>{cancelLabel}</Text>
          </PressableScale>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { width: 50, height: 50, borderRadius: SHAPE.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12, gap: 8 },
  group: { borderRadius: SHAPE.card, borderCurve: 'continuous', overflow: 'hidden' },
  title: { fontSize: TYPE.footnote, fontWeight: '600', textAlign: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  row: { minHeight: MIN_TOUCH + 8, justifyContent: 'center', paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth },
  rowText: { fontSize: TYPE.body, textAlign: 'center' },
  cancel: { minHeight: MIN_TOUCH + 8, justifyContent: 'center' },
  cancelText: { fontWeight: '600' },
});
