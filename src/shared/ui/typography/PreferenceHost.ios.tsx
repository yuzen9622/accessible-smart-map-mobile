import { Host, type HostProps } from '@expo/ui/swift-ui';
import { dynamicTypeSize } from '@expo/ui/swift-ui/modifiers';
import { useWindowDimensions } from 'react-native';

import { preferredDynamicTypeSize } from '@/shared/preferences/dynamicTypeSize';
import { usePreferencesStore } from '@/shared/preferences/preferencesStore';

/** SwiftUI labels, fields and buttons share the App preference and still react to system text size. */
export default function PreferenceHost({ modifiers = [], ...props }: HostProps) {
  const level = usePreferencesStore((state) => state.fontSize);
  const { fontScale } = useWindowDimensions();
  const size = preferredDynamicTypeSize(level, fontScale);
  return <Host {...props} modifiers={size ? [dynamicTypeSize(size), ...modifiers] : modifiers} />;
}
