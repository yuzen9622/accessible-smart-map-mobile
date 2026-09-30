import { Alert, Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/shared/ui';

import type { MoreActionsButtonProps } from './MoreActionsButton.types';

/** 地點動作列的「⋯」：fallback（web／型別解析）：以 Alert 列出次要動作。 */
export default function MoreActionsButton({ label, cancelLabel, actions, backgroundColor, color }: MoreActionsButtonProps) {
  const open = () => {
    Alert.alert(label, undefined, [
      ...actions.map((action) => ({ text: action.label, onPress: action.onPress })),
      { text: cancelLabel, style: 'cancel' as const },
    ]);
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={open}
      style={[styles.button, { backgroundColor }]}>
      <Icon name="ellipsis" size={20} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
});
