import { HStack, Host, RNHostView, ShareLink } from '@expo/ui/swift-ui';
import { accessibilityLabel, contentShape, frame, shapes } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { RADIUS, semanticColors } from '@/shared/theme';

import { Icon } from '@/shared/ui';

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
  const tones = semanticColors(useColorScheme() === 'dark');
  const accentText = tones.accent;
  return (
    <View style={[styles.circle, { backgroundColor: tones.accentSoft }]}>
      <Host matchContents>
        <ShareLink item={url} subject={title}>
          {/* 圖示圓鈕，與旁邊的收藏、複製同一種樣式；文字只放在無障礙標籤（VoiceOver 仍念「分享」） */}
          <HStack modifiers={[frame({ width: 50, height: 50 }), contentShape(shapes.rectangle()), accessibilityLabel(label)]}>
            <RNHostView matchContents>
              <Icon name="share" size={20} color={accentText} />
            </RNHostView>
          </HStack>
        </ShareLink>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
