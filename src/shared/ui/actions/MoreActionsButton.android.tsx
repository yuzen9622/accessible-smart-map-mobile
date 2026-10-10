import { Host } from '@expo/ui';
import { DropdownMenu, DropdownMenuItem, RNHostView, Text } from '@expo/ui/jetpack-compose';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import Icon from '../Icon';

import type { MoreActionsButtonProps } from './MoreActionsButton.types';

/** Android 使用錨定在「⋯」按鈕的原生下拉選單。 */
export default function MoreActionsButton({ label, actions, backgroundColor, color }: MoreActionsButtonProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Host matchContents ignoreSafeArea="all">
      <DropdownMenu expanded={expanded} onDismissRequest={() => setExpanded(false)}>
        <DropdownMenu.Trigger>
          <RNHostView matchContents>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ expanded }}
              onPress={() => setExpanded(true)}
              android_ripple={{ borderless: true }}
              style={({ pressed }) => [styles.button, { backgroundColor }, pressed && styles.pressed]}>
              <Icon name="ellipsis" size={20} color={color} />
            </Pressable>
          </RNHostView>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.label}
              onClick={() => {
                setExpanded(false);
                action.onPress();
              }}>
              <DropdownMenuItem.Text>
                <Text>{action.label}</Text>
              </DropdownMenuItem.Text>
            </DropdownMenuItem>
          ))}
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}

const styles = StyleSheet.create({
  button: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
