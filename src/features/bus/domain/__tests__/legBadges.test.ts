import { resolveLiveEta, resolveWaitText } from '../legBadges';

describe('resolveWaitText', () => {
  it('schedule + string is departsAt', () => {
    expect(resolveWaitText({ source: 'schedule', time: '23:08' })).toEqual({ key: 'departsAt', params: { time: '23:08' } });
  });
  it('numeric time is waitMinutes', () => {
    expect(resolveWaitText({ source: 'realtime', time: 5 })).toEqual({ key: 'waitMinutes', params: { count: 5 } });
  });
  it('unavailable, null and mismatched values show nothing', () => {
    expect(resolveWaitText({ source: 'unavailable', time: 5 })).toBeNull();
    expect(resolveWaitText({ source: 'realtime', time: null })).toBeNull();
    expect(resolveWaitText({ source: 'realtime', time: '23:08' })).toBeNull();
    expect(resolveWaitText(undefined)).toBeNull();
  });
});

describe('resolveLiveEta', () => {
  it('maps thresholds', () => {
    expect(resolveLiveEta(0)?.key).toBe('busRealtimeArriving');
    expect(resolveLiveEta(2)?.key).toBe('busRealtimeSoon');
    expect(resolveLiveEta(5)).toEqual({ key: 'busRealtimeMinutes', params: { count: 5 }, tone: 'ok' });
    expect(resolveLiveEta(12)?.tone).toBe('normal');
  });
  it('rejects missing or negative', () => {
    expect(resolveLiveEta(null)).toBeNull();
    expect(resolveLiveEta(undefined)).toBeNull();
    expect(resolveLiveEta(-1)).toBeNull();
  });
});
