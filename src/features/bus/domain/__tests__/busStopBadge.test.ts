import { resolveStopBadge } from '../busStopBadge';

describe('resolveStopBadge', () => {
  it('null estimate without usable status is unknown, never 尚未發車', () => {
    const unknown = { kind: 'unknown', tone: 'muted' };
    expect(resolveStopBadge({ estimateMinutes: null, statusLabel: '' })).toEqual(unknown);
    expect(resolveStopBadge({ estimateMinutes: null })).toEqual(unknown);
    expect(resolveStopBadge({ estimateMinutes: null, statusLabel: '   ' })).toEqual(unknown);
    expect(resolveStopBadge({ estimateMinutes: null, statusLabel: '正常' })).toEqual(unknown);
    expect(resolveStopBadge({ estimateMinutes: null, statusLabel: '暫無到站資訊' })).toEqual(unknown);
  });
  it('only an explicit 尚未發車 is notDeparted', () => {
    expect(resolveStopBadge({ estimateMinutes: null, statusLabel: '尚未發車' })).toEqual({ kind: 'notDeparted', tone: 'muted' });
  });
  it('null estimate with a status or schedule shows that text', () => {
    expect(resolveStopBadge({ estimateMinutes: null, statusLabel: '18:15' })).toEqual({
      kind: 'status',
      tone: 'muted',
      statusText: '18:15',
    });
    expect(resolveStopBadge({ estimateMinutes: null, statusLabel: '末班車已過' }).kind).toBe('status');
  });
  it('treats negative and NaN estimates as missing', () => {
    expect(resolveStopBadge({ estimateMinutes: -1, statusLabel: '' }).kind).toBe('unknown');
    expect(resolveStopBadge({ estimateMinutes: Number.NaN }).kind).toBe('unknown');
  });
  it('0 is arriving, under 3 is soon, both red', () => {
    expect(resolveStopBadge({ estimateMinutes: 0 })).toEqual({ kind: 'arriving', tone: 'arriving' });
    expect(resolveStopBadge({ estimateMinutes: 2 })).toEqual({ kind: 'soon', tone: 'arriving' });
  });
  it('3 or more is minutes, green', () => {
    expect(resolveStopBadge({ estimateMinutes: 3 })).toEqual({ kind: 'minutes', tone: 'ok', minutes: 3 });
    expect(resolveStopBadge({ estimateMinutes: 8 }).minutes).toBe(8);
  });
});
