import { requireNativeViewManager, requireOptionalNativeModule } from 'expo-modules-core';
import type { ComponentType } from 'react';
import type { ViewProps } from 'react-native';

export interface SheetEdgeFollowerProps extends ViewProps {
  /** 內容底緣與 sheet 上緣的距離（pt），預設 4 */
  gap?: number;
}

// 只有 iOS 且已重建的 dev client 才有這個 native view；其餘情況回傳 null，由呼叫端退回 JS 定位。
const NativeView: ComponentType<SheetEdgeFollowerProps> | null = requireOptionalNativeModule('SheetDetent')
  ? requireNativeViewManager<SheetEdgeFollowerProps>('SheetDetent', 'SheetEdgeFollowerView')
  : null;

export default NativeView;
