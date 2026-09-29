import type { LiveActivity } from 'expo-widgets';
import type { SFSymbol } from 'expo-symbols';

import type { LiveNavigationSnapshot } from '../domain/liveNavigation';
import type { NavStepIconName } from '../domain/navStepIcon';
import NavigationActivity, { type NavigationActivityProps } from './NavigationLiveActivity';
import type { CreateLiveNavigationPort, LiveActivityTexts } from './liveActivityPort.types';

/** HUD 的 Lucide 轉向圖示 → Live Activity 的 SF Symbol（widget runtime 無法畫 Lucide SVG）。 */
const SF_SYMBOL: Record<NavStepIconName, SFSymbol> = {
  arrowDown: 'arrow.down',
  arrowUp: 'arrow.up',
  arrowUpDown: 'arrow.up.arrow.down',
  arrowUpLeft: 'arrow.up.left',
  arrowUpRight: 'arrow.up.right',
  bike: 'bicycle',
  bus: 'bus',
  car: 'car',
  cornerUpLeft: 'arrow.turn.up.left',
  cornerUpRight: 'arrow.turn.up.right',
  flag: 'flag.checkered',
  navigation: 'location.north.fill',
  redo2: 'arrow.uturn.right',
  squareParking: 'parkingsign',
  tramFront: 'tram',
  undo2: 'arrow.uturn.left',
};

function toProps(snapshot: LiveNavigationSnapshot, texts: LiveActivityTexts): NavigationActivityProps {
  return {
    symbol: SF_SYMBOL[snapshot.icon],
    instruction: snapshot.instruction,
    distance: snapshot.distanceToNextM != null ? texts.distance(snapshot.distanceToNextM) : '',
    eta: snapshot.estimatedArrivalAt != null ? texts.eta(snapshot.estimatedArrivalAt) : '',
    remaining: snapshot.remainingDurationSec != null ? texts.remaining(snapshot.remainingDurationSec) : '',
    progress: snapshot.progress ?? -1,
    rerouting: snapshot.rerouting,
    reroutingText: texts.rerouting,
  };
}

async function endActivity(activity: LiveActivity<NavigationActivityProps>): Promise<void> {
  try {
    await activity.end('immediate');
  } catch (error) {
    console.warn('[live-activity] end failed', error);
  }
}

/**
 * iOS LiveNavigationPort：`expo-widgets` 的 Live Activity。ActivityKit 呼叫失敗（使用者關掉即時動態、
 * 系統預算用完）只記 log，不影響導航本身。
 *
 * `end` 只結束這個 process 持有的那張（抵達後再按「結束導航」會呼叫第二次，第二次是 no-op）；
 * 上一次 App 被殺掉時留下的活動，在下一次 `start` 前用 `getInstances()` 清掉。
 */
export const createLiveNavigationPort: CreateLiveNavigationPort = (texts) => {
  let instance: LiveActivity<NavigationActivityProps> | null = null;

  return {
    start(snapshot) {
      try {
        if (!instance) {
          for (const leftover of NavigationActivity.getInstances()) void endActivity(leftover);
        }
        instance = NavigationActivity.start(toProps(snapshot, texts()), 'accessiblesmartmap://');
      } catch (error) {
        console.warn('[live-activity] start failed', error);
      }
    },
    update(snapshot) {
      const current = instance;
      if (!current) return;
      const run = async () => {
        try {
          await current.update(toProps(snapshot, texts()));
        } catch (error) {
          console.warn('[live-activity] update failed', error);
        }
      };
      void run();
    },
    end() {
      const current = instance;
      instance = null;
      if (current) void endActivity(current);
    },
  };
};
