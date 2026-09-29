import { noopLiveNavigation } from '../domain/liveNavigation';
import type { CreateLiveNavigationPort } from './liveActivityPort.types';

/**
 * Android／fallback：鎖定畫面的常駐導航通知由背景定位的前景服務通知提供
 * （`startBackgroundLocation` 的 `foregroundService`，`killServiceOnDestroy`）。逐步更新通知內容需要
 * 自訂原生模組，本機沒有 Android 裝置可驗證，列為已知限制（見 docs/port-ledger.md）。
 */
export const createLiveNavigationPort: CreateLiveNavigationPort = () => noopLiveNavigation;
