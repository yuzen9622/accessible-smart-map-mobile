import type { TFunction } from 'i18next';

import type { BusStopBadge, EtaLabel, EtaTone } from '../domain';
import type { PillTone } from './palette';

export function badgeText(t: TFunction, badge: BusStopBadge): string {
  switch (badge.kind) {
    case 'arriving':
      return t('busArrivalArriving');
    case 'soon':
      return t('busArrivalSoon');
    case 'minutes':
      return t('nativeBusEtaMinutes', { count: badge.minutes ?? 0 });
    case 'status':
      return badge.statusText ?? t('busNotDeparted');
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
