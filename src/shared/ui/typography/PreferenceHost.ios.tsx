import { Host, type HostProps } from '@expo/ui/swift-ui';
import { dynamicTypeSize } from '@expo/ui/swift-ui/modifiers';
import { useWindowDimensions } from 'react-native';

import { preferredDynamicTypeSize } from '@/shared/preferences/dynamicTypeSize';
import { usePreferencesStore } from '@/shared/preferences/preferencesStore';
import { useSemanticColors } from '@/shared/theme';

/**
 * SwiftUI labels, fields and buttons share the App preference and still react to system text size.
 *
 * `seedColor` 永遠給一個實色，不要在「有色」與 `undefined` 之間切換：原生端的 `SeedColorModifier`
 * 是 `if let seedColor { .tint(…) } else { content }`，SwiftUI 的 `if/else` 分支切換視同換了一棵
 * 子樹，會把整個 `Host`（含 Form 的捲動位置）整個砍掉重建。高對比開關就是切這個值，切換時整個
 * 設定頁會彈回最頂端（使用者回饋 2026-10-25 錄影）。固定給色之後分支永遠走 `if`，只是換色值，
 * 不會砍重建。
 */
export default function PreferenceHost({ modifiers = [], seedColor, ...props }: HostProps) {
  const level = usePreferencesStore((state) => state.fontSize);
  const tones = useSemanticColors();
  const { fontScale } = useWindowDimensions();
  const size = preferredDynamicTypeSize(level, fontScale);
  return <Host {...props} seedColor={seedColor ?? tones.accent} modifiers={size ? [dynamicTypeSize(size), ...modifiers] : modifiers} />;
}
