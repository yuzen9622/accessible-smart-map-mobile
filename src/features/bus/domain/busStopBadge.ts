// 對齊 Web `BusPanel.tsx` 的 `RouteStopCard` 徽章規則。

export type BusStopBadgeKind = 'notDeparted' | 'status' | 'arriving' | 'soon' | 'minutes';
export type BusStopBadgeTone = 'muted' | 'arriving' | 'ok';

export interface BusStopBadge {
  kind: BusStopBadgeKind;
  tone: BusStopBadgeTone;
  /** kind === 'minutes' 時的分鐘數。 */
  minutes?: number;
  /** kind === 'status' 時的後端原文（下一班時刻等）。 */
  statusText?: string;
}

/**
 * - estimateMinutes 為 null（或負數）：有 statusLabel 就顯示它，否則「尚未發車」（灰）。
 * - 0：進站中（紅）；< 3：即將到站（紅）；其餘 `{n} 分鐘`（綠）。
 */
export function resolveStopBadge(stop: { estimateMinutes: number | null; statusLabel?: string }): BusStopBadge {
  const m = stop.estimateMinutes;
  if (m === null || !Number.isFinite(m) || m < 0) {
    const label = stop.statusLabel?.trim() ?? '';
    return label ? { kind: 'status', tone: 'muted', statusText: label } : { kind: 'notDeparted', tone: 'muted' };
  }
  if (m === 0) return { kind: 'arriving', tone: 'arriving' };
  if (m < 3) return { kind: 'soon', tone: 'arriving' };
  return { kind: 'minutes', tone: 'ok', minutes: Math.round(m) };
}
