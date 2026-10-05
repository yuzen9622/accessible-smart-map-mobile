import type { TFunction } from 'i18next';

import { parseStatusLabel, type BusStopBadge, type EtaLabel, type EtaTone } from '../domain';
import type { PillTone } from './palette';

export function badgeText(t: TFunction, badge: BusStopBadge): string {
  switch (badge.kind) {
    case 'arriving':
      return t('busArrivalArriving');
    case 'soon':
      return t('busArrivalSoon');
    case 'minutes':
      return t('nativeBusEtaMinutes', { count: badge.minutes ?? 0 });
    case 'status': {
      // 班表時刻與狀態文字沿用 parseStatusLabel 的翻譯；認不得的文字原樣顯示。班表不冒充即時倒數。
      const parsed = parseStatusLabel(badge.statusText ?? '');
      return parsed?.key ? t(parsed.key, parsed.params) : (badge.statusText ?? t('busEtaUnknown'));
    }
    case 'unknown':
      return t('busEtaUnknown');
    case 'notDeparted':
      return t('busNotDeparted');
  }
}

export function badgePillTone(badge: BusStopBadge): PillTone {
  return badge.tone === 'muted' ? 'muted' : badge.tone === 'arriving' ? 'arriving' : 'ok';
}

export function etaLabelText(t: TFunction, label: EtaLabel): string | null {
  if (!label.key) return null;
  return t(label.key, label.params);
}

export function etaTonePill(tone: EtaTone): PillTone {
  return tone === 'soon' ? 'ok' : tone;
}
