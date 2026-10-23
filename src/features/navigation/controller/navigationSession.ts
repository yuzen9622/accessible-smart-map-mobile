import { router } from 'expo-router';

import { mapCamera, sheetNavigation } from '@/features/map';
import { fitSelectedRoute, getRouteSessionSnapshot } from '@/features/route';
import { startBackgroundLocation, stopBackgroundLocation, type BackgroundLocationTexts } from '@/shared/location';
import { logger } from '@/shared/logger';

import { useNavStore } from '../store/navStore';
import { startNavigation, stopNavigation } from './navigationLifecycle';
import { haptic } from '@/shared/haptics';

/**
 * 「開始導航」的完整流程（Web `RouteContent.handleStartNav` + `NavigationController` 掛載）：
 * 1. `startNavigation()`（lifecycle：先開重算 session 再切到導航中，順序逐行對齊 Web）；
 * 2. sheet 換成步驟清單（HUD 由地圖畫面在 `isNavigating` 時顯示）；
 * 3. 背景定位（需要「永遠允許」；使用者拒絕時仍以前景定位導航）。
 * Web 的 iOS 羅盤權限步驟不需要：原生羅盤隨定位權限授予。
 */
export function beginNavigation(texts: BackgroundLocationTexts): void {
  if (!startNavigation()) return;
  haptic.commit();
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

/** 導航用的那條路線在結果中的位置；結果裡已沒有它（例：語音直接開的導航）時為 null。 */
function navigatedRouteIndex(): number | null {
  const { selectRoute, computeRoutes } = getRouteSessionSnapshot();
  if (!selectRoute || computeRoutes?.[selectRoute.index] !== selectRoute.route) return null;
  return selectRoute.index;
}

/**
 * 結束導航（HUD／收合列「結束」確認、抵達後「結束導航」、指示失效後「重新規劃」、語音 `nav.stop` 共用同一個出口）：
 * 停止引擎與背景定位、解除鏡頭跟隨，sheet 回到這條路線的「路線詳情」並把路線框回畫面；
 * 從詳情再返回就是規劃路線。路線 session 保留，離開規劃流程後由「回到路線」膠囊收尾。
 * 已不在導航中就不動作：連點或語音與按鈕同時結束時，第二次呼叫不能再多退一頁。
 */
export function endNavigation(): void {
  if (!useNavStore.getState().isNavigating) return;
  const routeIndex = navigatedRouteIndex();
  stopEngineAndLocation();
  // 從詳情開始導航時退回那一頁；從規劃路線開始時把導航頁換成詳情，堆疊變成「規劃 → 詳情」。
  // 結果裡找不到這條路線時只退掉導航頁。
  const backToDetail = () => {
    if (routeIndex === null) router.dismiss();
    else router.dismissTo({ pathname: '/routes/[index]', params: { index: String(routeIndex) } });
  };
  // sheet 被蓋住期間開始又結束（語音）時導航頁從沒推上去：取代掉排隊中的導向，使用者留在原本那頁。
  sheetNavigation.whenVisible(sheetNavigation.hasPending() ? () => {} : backToDetail);
  fitSelectedRoute();
}
