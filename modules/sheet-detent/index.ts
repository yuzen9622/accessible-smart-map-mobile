import { requireOptionalNativeModule } from 'expo-modules-core';

interface SheetDetentNativeModule {
  select(index: number): Promise<boolean>;
}

// Android 與尚未重建的 dev client 沒有這個 native module：回傳 null，呼叫端當作無法切換。
const native = requireOptionalNativeModule<SheetDetentNativeModule>('SheetDetent');

export function isSheetDetentAvailable(): boolean {
  return native !== null;
}

/** 以動畫把常駐 sheet 切到第 `index` 個 detent；成功換了才回傳 true。 */
export async function selectSheetDetent(index: number): Promise<boolean> {
  if (!native) return false;
  return native.select(index);
}

export { default as SheetEdgeFollower, type SheetEdgeFollowerProps } from './SheetEdgeFollower';
