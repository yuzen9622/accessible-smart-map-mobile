import { stepIcon } from '../domain/navStepIcon';
import { buildLiveSnapshot, shouldSendLiveUpdate, type LiveNavigationPort, type LiveThrottleState } from '../domain/liveNavigation';
import { useNavStore } from '../store/navStore';

/**
 * 把導航狀態接到 `LiveNavigationPort`（iOS Live Activity／Android 常駐通知）：
 * - 導航開始 → `start`；每次狀態變動組快照，經 `shouldSendLiveUpdate` 節流後 `update`；
 * - 抵達、結束導航 → 立即 `end`（SDD §6.4 不變量：不得殘留在鎖定畫面）。
 * 重算中快照的 `rerouting` 為 true，鎖定畫面同步改顯示「重新規劃路線中」。
 */
export function startLiveNavigationDriver(port: LiveNavigationPort, now: () => number = Date.now): () => void {
  let active = false;
  let throttle: LiveThrottleState = { lastSentAt: 0, last: null };

  const snapshot = () => {
    const s = useNavStore.getState();
    return buildLiveSnapshot(
      {
        instructions: s.instructions,
        currentStepIndex: s.currentStepIndex,
        distanceToNextM: s.distanceToNextM,
        remainingM: s.remainingM,
        routeTotalM: s.routeTotalM,
        estimatedArrivalAt: s.estimatedArrivalAt,
        remainingDurationSec: s.remainingDurationSec,
        rerouteStatus: s.rerouteStatus,
      },
      stepIcon,
    );
  };

  const end = () => {
    if (!active) return;
    active = false;
    throttle = { lastSentAt: 0, last: null };
    port.end();
  };

  const sync = () => {
    const s = useNavStore.getState();
    if (!s.isNavigating || s.arrived) {
      end();
      return;
    }
    const next = snapshot();
    const t = now();
    if (!active) {
      active = true;
      port.start(next);
      throttle = { lastSentAt: t, last: next };
      return;
    }
    if (!shouldSendLiveUpdate(throttle, next, t)) return;
    port.update(next);
    throttle = { lastSentAt: t, last: next };
  };

  sync();
  const unsubscribe = useNavStore.subscribe(sync);
  return () => {
    unsubscribe();
    end();
  };
}
