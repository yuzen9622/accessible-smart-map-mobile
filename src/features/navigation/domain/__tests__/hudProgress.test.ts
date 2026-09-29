import { hudProgress, rerouteStripText } from '../hudProgress';

describe('hudProgress', () => {
  const base = { remainingDurationSec: null, remainingM: null, routeTotalM: null, routeTotalMinutes: null, estimatedArrivalAt: null, now: 0 };

  it('prefers the engine/server duration, rounded, at least one minute', () => {
    expect(hudProgress({ ...base, remainingDurationSec: 20 }).remainMinutes).toBe(1);
    expect(hudProgress({ ...base, remainingDurationSec: 610 }).remainMinutes).toBe(10);
  });

  it('falls back to the route minutes scaled by the remaining distance', () => {
    expect(hudProgress({ ...base, remainingM: 500, routeTotalM: 1000, routeTotalMinutes: 20 }).remainMinutes).toBe(10);
  });

  it('shows the whole-route minutes before the engine reports progress', () => {
    expect(hudProgress({ ...base, routeTotalMinutes: 26.4 }).remainMinutes).toBe(26);
  });

  it('uses the server ETA when present, otherwise now + remaining', () => {
    expect(hudProgress({ ...base, remainingDurationSec: 600, estimatedArrivalAt: 123 }).arrivalAt).toBe(123);
    expect(hudProgress({ ...base, remainingDurationSec: 600, now: 1000 }).arrivalAt).toBe(1000 + 600_000);
    expect(hudProgress(base)).toEqual({ remainMinutes: null, arrivalAt: null });
  });
});

describe('rerouteStripText', () => {
  it('shows the error first, then the pending reason, then off-route', () => {
    expect(rerouteStripText({ rerouteError: '伺服器忙碌', rerouteStatus: 'error', lastRerouteReason: null })).toEqual({ text: '伺服器忙碌' });
    expect(rerouteStripText({ rerouteError: null, rerouteStatus: 'pending', lastRerouteReason: 'OFF_ROUTE' })).toEqual({ key: 'rerouteReasonOffRoute' });
    expect(rerouteStripText({ rerouteError: null, rerouteStatus: 'pending', lastRerouteReason: null })).toEqual({ key: 'recalculate' });
    expect(rerouteStripText({ rerouteError: null, rerouteStatus: 'idle', lastRerouteReason: null })).toEqual({ key: 'offRoute' });
  });
});
