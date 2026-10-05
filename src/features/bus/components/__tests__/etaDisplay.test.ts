import type { TFunction } from 'i18next';

import { parseStatusLabel } from '../../domain';
import { etaDisplay } from '../etaDisplay';

const t = ((key: string, params?: Record<string, unknown>) =>
  params ? `${key}:${Object.values(params).join(',')}` : key) as unknown as TFunction;

const show = (estimateMinutes: number | null, statusLabel = '') => etaDisplay(t, { estimateMinutes, statusLabel });

describe('etaDisplay', () => {
  it('keeps the numeric rules for ETA 0, 2 and 8', () => {
    expect(show(0)).toMatchObject({ minutes: null, text: 'busArrivalArriving', tone: 'arriving' });
    expect(show(2)).toMatchObject({ minutes: 2, text: 'busArrivalSoon' });
    expect(show(8)).toMatchObject({ minutes: 8, text: 'nativeBusEtaMinutes:8', tone: 'ok' });
  });

  it('null with an explicit status keeps its meaning through the shared translation', () => {
    expect(show(null, '末班車已過').text).toBe('busServiceEnded');
    expect(show(null, '交管不停靠').text).toBe('busStopSkipped');
    expect(show(null, '今日未營運').text).toBe('busNoServiceToday');
    expect(show(null, '尚未發車').text).toBe('busNotDeparted');
  });

  it('a schedule text is a scheduled time, never a live countdown', () => {
    expect(show(null, '18:15')).toMatchObject({ minutes: null, text: 'busScheduledAt:18:15' });
    expect(show(null, '明日 06:00 起點發車').text).toBe('busScheduledTomorrowFromOrigin:06:00');
  });

  it('null with blank, missing, 正常 or 暫無到站資訊 is "no arrival info", never 尚未發車 and never 0', () => {
    for (const label of ['', '  ', '正常', '暫無到站資訊']) {
      expect(show(null, label)).toMatchObject({ minutes: null, text: 'busEtaUnknown' });
    }
  });

  it('an unknown status text is shown verbatim', () => {
    expect(show(null, '臨時改道').text).toBe('臨時改道');
  });
});

describe('parseStatusLabel', () => {
  it('maps 暫無到站資訊 to the unknown label and leaves 正常 undecided', () => {
    expect(parseStatusLabel('暫無到站資訊')?.key).toBe('busEtaUnknown');
    expect(parseStatusLabel('正常')).toBeNull();
  });
});
