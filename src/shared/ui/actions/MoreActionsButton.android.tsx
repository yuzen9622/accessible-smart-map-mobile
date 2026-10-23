import { Host } from '@expo/ui';
import { DropdownMenu, DropdownMenuItem, RNHostView, Text } from '@expo/ui/jetpack-compose';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import Icon from '../Icon';

import type { MoreActionsButtonProps } from './MoreActionsButton.types';
import { SHAPE, ICON_SIZE } from '@/shared/theme';
import PressableScale from '@/shared/ui/PressableScale';

/** Android 使用錨定在「⋯」按鈕的原生下拉選單。 */
export default function MoreActionsButton({ label, actions, backgroundColor, color }: MoreActionsButtonProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Host matchContents ignoreSafeArea="all">
      <DropdownMenu expanded={expanded} onDismissRequest={() => setExpanded(false)}>
        <DropdownMenu.Trigger>
          <RNHostView matchContents>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ expanded }}
              onPress={() => setExpanded(true)}
              style={[styles.button, { backgroundColor }]}>
              <Icon name="ellipsis" size={ICON_SIZE.control} color={color} />
            </PressableScale>
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
  button: { width: 50, height: 50, borderRadius: SHAPE.pill, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
});
