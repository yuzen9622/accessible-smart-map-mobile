import { router } from 'expo-router';

import { mapCamera } from '@/features/map';
import { fitSelectedRoute } from '@/features/route';
import { startBackgroundLocation, stopBackgroundLocation, type BackgroundLocationTexts } from '@/shared/location';
import { logger } from '@/shared/logger';

import { useNavStore } from '../store/navStore';
import { startNavigation, stopNavigation } from './navigationLifecycle';

/**
 * 「開始導航」的完整流程（Web `RouteContent.handleStartNav` + `NavigationController` 掛載）：
 * 1. `startNavigation()`（lifecycle：先開重算 session 再切到導航中，順序逐行對齊 Web）；
 * 2. sheet 換成步驟清單（HUD 由地圖畫面在 `isNavigating` 時顯示）；
 * 3. 背景定位（需要「永遠允許」；使用者拒絕時仍以前景定位導航）。
 * Web 的 iOS 羅盤權限步驟不需要：原生羅盤隨定位權限授予。
 */
export function beginNavigation(texts: BackgroundLocationTexts): void {
  startNavigation();
  // Web 預設不播報（瀏覽器要使用者手勢才能發聲）；原生沒有這個限制，導航一開始就播報，
  // 使用者可在 HUD 關掉（差異記在 port-ledger）。
  useNavStore.getState().setVoiceEnabled(true);
  router.navigate('/navigation');
  const run = async () => {
    try {
      await startBackgroundLocation(texts);
    } catch (error) {
      logger.warn('[navigation] background location unavailable', error);
    }
  };
  void run();
}

/**
 * 結束導航（HUD「結束」確認、抵達後「結束導航」）：停止引擎與背景定位、解除鏡頭跟隨，
 * sheet 回到路線結果並把路線框回畫面。路線 session 保留（pill 仍可結束它），對齊 Web。
 */
export function endNavigation(): void {
  stopNavigation();
  mapCamera.stopFollow();
  const run = async () => {
    try {
      await stopBackgroundLocation();
    } catch (error) {
      logger.warn('[navigation] stop background location failed', error);
    }
  };
  void run();
  // 回到路線結果：堆疊裡有 `/routes` 就退回它，沒有（例：深層連結直接開導航）就把目前畫面換成它。
  // 不用 router.back()：導航頁的上一頁不一定是路線頁（從明細頁開始導航時是明細）。
  router.dismissTo('/routes');
  fitSelectedRoute();
}
