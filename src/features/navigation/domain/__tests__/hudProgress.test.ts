import { hudProgress, rerouteStripText, stripStepDistance } from '../hudProgress';

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

describe('stripStepDistance', () => {
  it('drops the baked-in distance from Chinese steps', () => {
    expect(stripStepDistance('直行約 110 公尺至「松山路」')).toBe('直行至「松山路」');
    expect(stripStepDistance('請繼續直行，續行約 130 公尺')).toBe('請繼續直行');
    expect(stripStepDistance('向右轉，續行約 40 公尺，注意路口')).toBe('向右轉，注意路口');
  });

  it('drops the baked-in distance from English steps', () => {
    expect(stripStepDistance('Continue for about 110 m onto Songshan Rd')).toBe('Continue onto Songshan Rd');
    expect(stripStepDistance('Walk 1.2 km to the station')).toBe('Walk to the station');
    expect(stripStepDistance('Turn right, then continue for 40 m')).toBe('Turn right');
  });

  it('keeps text without a distance, and never returns empty', () => {
    expect(stripStepDistance('右轉 忠孝東路一段')).toBe('右轉 忠孝東路一段');
    expect(stripStepDistance('110 公尺')).toBe('110 公尺');
  });
});
