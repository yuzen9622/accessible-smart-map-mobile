// 對齊 Web `LegDetail.tsx` 的 `WaitBadge` 與 `TransitStops.tsx` 的 `EndpointTime` 規則（commit 5eadc71）。
import type { WaitInfo } from '@/features/route/domain';

export interface LegText {
  key: string;
  params?: Record<string, string | number>;
}

/**
 * 「等候 23:08」會被讀成等 23 小時：schedule 來源帶的是發車時刻（字串），realtime 帶的是等候分鐘（數字）。
 * unavailable 或沒有可用的值都不顯示。
 */
export function resolveWaitText(waitInfo: WaitInfo | null | undefined): LegText | null {
  if (!waitInfo || waitInfo.source === 'unavailable') return null;
  if (waitInfo.source === 'schedule' && typeof waitInfo.time === 'string') {
    return { key: 'departsAt', params: { time: waitInfo.time } };
  }
  if (typeof waitInfo.time === 'number') return { key: 'waitMinutes', params: { count: waitInfo.time } };
  return null;
}

export type LiveEtaTone = 'arriving' | 'ok' | 'normal';

export interface LiveEta extends LegText {
  tone: LiveEtaTone;
}

/** 上車站的即時倒數：0 進站、<3 即將到站、其餘分鐘數；沒有有效數字回 null（改顯示預定時刻）。 */
export function resolveLiveEta(minutes: number | null | undefined): LiveEta | null {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes < 0) return null;
  if (minutes === 0) return { key: 'busRealtimeArriving', tone: 'arriving' };
  if (minutes < 3) return { key: 'busRealtimeSoon', tone: 'arriving' };
  return { key: 'busRealtimeMinutes', params: { count: minutes }, tone: minutes < 10 ? 'ok' : 'normal' };
}
