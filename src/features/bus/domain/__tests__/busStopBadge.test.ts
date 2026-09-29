import { resolveStopBadge } from '../busStopBadge';

describe('resolveStopBadge', () => {
  it('null estimate without status is 尚未發車 (muted)', () => {
    expect(resolveStopBadge({ estimateMinutes: null, statusLabel: '' })).toEqual({ kind: 'notDeparted', tone: 'muted' });
    expect(resolveStopBadge({ estimateMinutes: null })).toEqual({ kind: 'notDeparted', tone: 'muted' });
  });
  it('null estimate with status shows the status text', () => {
    expect(resolveStopBadge({ estimateMinutes: null, statusLabel: '18:15' })).toEqual({
      kind: 'status',
      tone: 'muted',
      statusText: '18:15',
    });
  });
  it('treats negative estimate as missing', () => {
    expect(resolveStopBadge({ estimateMinutes: -1, statusLabel: '' }).kind).toBe('notDeparted');
  });
  it('0 is arriving, under 3 is soon, both red', () => {
    expect(resolveStopBadge({ estimateMinutes: 0 })).toEqual({ kind: 'arriving', tone: 'arriving' });
    expect(resolveStopBadge({ estimateMinutes: 2 })).toEqual({ kind: 'soon', tone: 'arriving' });
  });
  it('3 or more is minutes, green', () => {
    expect(resolveStopBadge({ estimateMinutes: 3 })).toEqual({ kind: 'minutes', tone: 'ok', minutes: 3 });
    expect(resolveStopBadge({ estimateMinutes: 12 }).minutes).toBe(12);
  });
});
