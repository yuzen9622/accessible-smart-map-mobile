import type { ReactNode } from 'react';

export interface KeyboardAvoidingHostProps {
  /** SwiftUI 表單內容（iOS 是 `@expo/ui/swift-ui` 的 `Form`）。 */
  children: ReactNode;
}
