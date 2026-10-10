import { Host } from '@expo/ui';
import { Button, Menu, RNHostView } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';

import Icon from '../Icon';

import type { MoreActionsButtonProps } from './MoreActionsButton.types';

/** 點一下即在「⋯」旁展開 SwiftUI Menu，保留 Lucide 圖示與觸控範圍。 */
export default function MoreActionsButton({ label, actions, backgroundColor, color }: MoreActionsButtonProps) {
  return (
    <Host matchContents ignoreSafeArea="all">
      <Menu
        modifiers={[buttonStyle('plain'), accessibilityLabel(label)]}
        label={
          <RNHostView matchContents>
            <View style={[styles.button, { backgroundColor }]}>
              <Icon name="ellipsis" size={20} color={color} />
            </View>
          </RNHostView>
        }>
        {actions.map((action) => (
          <Button key={action.label} label={action.label} onPress={action.onPress} />
        ))}
      </Menu>
    </Host>
  );
}

const styles = StyleSheet.create({
  button: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
});
