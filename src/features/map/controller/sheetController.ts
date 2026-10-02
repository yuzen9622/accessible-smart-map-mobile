import { Dimensions } from 'react-native';

import { isSheetDetentAvailable, selectSheetDetent } from '../../../../modules/sheet-detent';
import { sheetBottomInset } from '../domain/sheetInset';
import { useMapUiStore } from '../store/mapUiStore';
import { logger } from '@/shared/logger';

/**
 * 常駐 sheet 的程式控制（Apple 地圖式的連貫轉場：拖地圖時讓位、選到地點時升到 half、搜尋時展開）。
 * react-native-screens 沒有「換 detent」的 API，由本地 native module `sheet-detent` 以動畫切換；
 * 程式切換不會發 `sheetDetentChange`，所以這裡自己同步 detent 索引與地圖 inset。
 * Android／尚未重建的 dev client 沒有 native module：呼叫會安靜失敗，sheet 維持使用者拖到的位置。
 */
async function select(index: number): Promise<boolean> {
  try {
    const changed = await selectSheetDetent(index);
    if (changed) {
      const store = useMapUiStore.getState();
      store.setSheetDetentIndex(index);
      store.setSheetInset(sheetBottomInset(index, Dimensions.get('window').height));
    }
    return changed;
  } catch (error) {
    logger.warn('[map] select sheet detent failed', error);
    return false;
  }
}

export const sheetController = {
  /** native module 是否存在（Android／舊 dev client 為 false，呼叫端退回舊行為）。 */
  available: isSheetDetentAvailable(),
  select,
  /** 收到最小（peek）；已經在 peek 時不動。 */
  collapse(): void {
    if (useMapUiStore.getState().sheetDetentIndex > 0) void select(0);
  },
  /** 至少升到第 `index` 個 detent；已經更高時不往下壓。 */
  raiseTo(index: number): void {
    if (useMapUiStore.getState().sheetDetentIndex < index) void select(index);
  },
};
