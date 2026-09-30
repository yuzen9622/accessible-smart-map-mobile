import type { TFunction } from 'i18next';

import { resolveStopBadge } from '../domain';
import type { RouteDetailStop } from '../types/transit';
import { badgePillTone, badgeText } from './busText';
import type { PillTone } from './palette';

export interface EtaDisplay {
  /** 大數字（分鐘）；進站中或沒有分鐘數時為 null，改顯示 {@link text}。 */
  minutes: number | null;
  text: string;
  tone: PillTone;
}

/** 站牌倒數的大字版本：有分鐘數就顯示數字＋「分」，否則顯示狀態文字（進站中、尚未發車、末班已過）。 */
export function etaDisplay(t: TFunction, stop: Pick<RouteDetailStop, 'estimateMinutes' | 'statusLabel'>): EtaDisplay {
  // `/bus/stop-arrivals` 的 statusLabel 是 TDX 原文：沒有分鐘數時的「正常」沒有資訊量，當作沒給。
  const statusLabel = stop.statusLabel === '正常' ? '' : stop.statusLabel;
  const badge = resolveStopBadge({ estimateMinutes: stop.estimateMinutes, statusLabel });
  const m = stop.estimateMinutes;
  const minutes = badge.kind === 'soon' || badge.kind === 'minutes' ? Math.max(1, Math.round(m ?? 0)) : null;
  return { minutes, text: badgeText(t, badge), tone: badgePillTone(badge) };
}
