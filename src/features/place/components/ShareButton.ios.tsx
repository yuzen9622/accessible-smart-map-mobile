import { HStack, Host, RNHostView, ShareLink, Text } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  contentShape,
  font,
  foregroundStyle,
  frame,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { Icon } from '@/shared/ui';

import { PLACE_ACCENT_COLOR, PLACE_ACCENT_COLOR_DARK, PLACE_BORDER_COLOR } from './palette';
import type { ShareButtonProps } from './ShareButton.types';

/**
 * iOS 分享：RN `Share` 從 root view controller 彈出，會被常駐的原生 formSheet
 * 擋住不顯示，所以 iOS 改用 SwiftUI `ShareLink`（從 sheet 自己的 VC 呈現）。
 *
 * 圖示必須是 Lucide（SDD ADR-16），不能用 SwiftUI 內建的 SF Symbol 圖示。
 * 採「路線 A」：label 內 `HStack` 放 `RNHostView matchContents` 嵌入 RN Lucide
 * `Share2`，與 `@expo/ui` 自家 `ListItem.ios.tsx` 相同手法；`contentShape` 讓整塊
 * （含圖示）都是 ShareLink 的點擊區，`Icon` 本身 `pointerEvents="none"`。
 * 外框（hairline 邊框、圓角）由外層 RN `View` 提供。
 */
export default function ShareButton({ url, title, label }: ShareButtonProps) {
  const accentText = useColorScheme() === 'dark' ? PLACE_ACCENT_COLOR_DARK : PLACE_ACCENT_COLOR;
  return (
    <View style={styles.pill}>
      <Host matchContents>
        <ShareLink item={url} subject={title}>
          <HStack
            spacing={6}
            modifiers={[
              padding({ horizontal: 14 }),
              frame({ minHeight: 44 }),
              contentShape(shapes.rectangle()),
              accessibilityLabel(label),
            ]}>
            <RNHostView matchContents>
              <Icon name="share" color={accentText} />
            </RNHostView>
            <Text modifiers={[foregroundStyle(accentText), font({ textStyle: 'body', weight: 'semibold' })]}>{label}</Text>
          </HStack>
        </ShareLink>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: PLACE_BORDER_COLOR,
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
