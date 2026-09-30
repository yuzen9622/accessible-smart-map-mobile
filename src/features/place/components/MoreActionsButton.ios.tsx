import { ActionSheetIOS, Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/shared/ui';

import type { MoreActionsButtonProps } from './MoreActionsButton.types';

/** 地點動作列的「⋯」：原生 action sheet 收納次要動作（回到此地點、複製連結）。 */
export default function MoreActionsButton({ label, cancelLabel, actions, backgroundColor, color }: MoreActionsButtonProps) {
  const open = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: label, options: [...actions.map((action) => action.label), cancelLabel], cancelButtonIndex: actions.length },
      (index) => actions[index]?.onPress(),
    );
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={open}
      style={({ pressed }) => [styles.button, { backgroundColor }, pressed && styles.pressed]}>
      <Icon name="ellipsis" size={20} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
