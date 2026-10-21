import { router } from 'expo-router';

import { mapCamera, sheetNavigation } from '@/features/map';
import { endRouteSession } from '@/features/route';
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
  if (!startNavigation()) return;
  // Web 預設不播報（瀏覽器要使用者手勢才能發聲）；原生沒有這個限制，導航一開始就播報，
  // 使用者可在 HUD 關掉（差異記在 port-ledger）。
  useNavStore.getState().setVoiceEnabled(true);
  sheetNavigation.whenVisible(() => router.navigate('/navigation'));
  const run = async () => {
    try {
      await startBackgroundLocation(texts);
    } catch (error) {
      logger.warn('[navigation] background location unavailable', error);
    }
  };
  void run();
}

function stopEngineAndLocation(): void {
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
}

/**
 * 結束導航（HUD／收合列「結束」確認、抵達後「結束導航」、指示失效後「重新規劃」共用同一個出口）：
 * 停止引擎與背景定位、解除鏡頭跟隨，並把路線 session 一併清掉——不論是中途放棄還是抵達，
 * 「結束導航」都是明確的終止動作，不該留著「回到路線」膠囊讓使用者以為還能接著走（使用者回饋：
 * 結束導航後跳開，但路線規劃的膠囊還留在畫面上，過時的目的地／剩餘時間一直在）。直接退回首頁。
 */
export function endNavigation(): void {
  stopEngineAndLocation();
  endRouteSession();
  sheetNavigation.whenVisible(() => router.dismissTo('/'));
}
