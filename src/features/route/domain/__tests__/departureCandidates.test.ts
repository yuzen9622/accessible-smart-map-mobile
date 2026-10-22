import {
  busRouteNames,
  candidateDeparture,
  followCandidate,
  formatRouteClock,
  minutesUntil,
  resolveViewedCandidate,
  routeDayOffset,
} from '../departureCandidates';
import type { BusDepartureCandidate, BusLeg } from '../../types/route';

function candidate(overrides: Partial<BusDepartureCandidate>): BusDepartureCandidate {
  return {
    candidateId: 'TXG5|1|600-U8|1792661451000',
    routeName: '5',
    subRouteUid: 'TXG5',
    direction: 1,
    departureStopId: 'TXG824',
    arrivalStopId: 'TXG2246',
    estimatedWaitMinutes: 8,
    boardingTime: '2026-10-22T17:30:51.000+08:00',
    alightingTime: '2026-10-22T17:35:51.000+08:00',
    boardingTimeSource: 'realtime',
    alightingTimeSource: 'realtime',
    vehicleAccessibility: 'unknown',
    hasLiftOrRamp: null,
    selected: false,
    ...overrides,
  };
}

const leg = { type: 'BUS', routeName: '5' } as BusLeg;

describe('formatRouteClock', () => {
  it('formats in Taiwan time regardless of the instant offset', () => {
    expect(formatRouteClock('2026-10-22T17:30:51.000+08:00')).toBe('17:30');
    expect(formatRouteClock('2026-10-22T09:30:00Z')).toBe('17:30');
  });

  it('rejects instants without an offset or date', () => {
    expect(formatRouteClock('17:30')).toBeNull();
    expect(formatRouteClock('2026-10-22T17:30:00')).toBeNull();
    expect(formatRouteClock(null)).toBeNull();
  });
});

describe('routeDayOffset', () => {
  it('counts Taiwan calendar days, not elapsed hours', () => {
    expect(routeDayOffset('2026-10-23T00:10:00+08:00', '2026-10-22T23:50:00+08:00')).toBe(1);
    expect(routeDayOffset('2026-10-22T23:59:00+08:00', '2026-10-22T00:01:00+08:00')).toBe(0);
  });
});

describe('minutesUntil', () => {
  const now = Date.parse('2026-10-22T17:22:51+08:00');
  it('rounds to whole minutes and never goes negative', () => {
    expect(minutesUntil('2026-10-22T17:30:51+08:00', now)).toBe(8);
    expect(minutesUntil('2026-10-22T17:20:00+08:00', now)).toBe(0);
    expect(minutesUntil(null, now)).toBeNull();
  });
});

describe('candidateDeparture', () => {
  const now = Date.parse('2026-10-22T17:22:51+08:00');
  it('counts a live bus down from its boarding time, not the stale query wait', () => {
    expect(candidateDeparture(candidate({ estimatedWaitMinutes: 99 }), now)).toEqual({ kind: 'live', minutes: 8, clock: '17:30' });
  });

  it('shows a timetable trip as a clock time', () => {
    const scheduled = candidate({ boardingTimeSource: 'schedule', boardingTime: '2026-10-22T17:39:00.000+08:00' });
    expect(candidateDeparture(scheduled, now)).toEqual({ kind: 'scheduled', clock: '17:39' });
  });

  it('falls back to the reported wait when a live bus has no boarding instant', () => {
    expect(candidateDeparture(candidate({ boardingTime: null, estimatedWaitMinutes: 3.29 }), now)).toEqual({ kind: 'live', minutes: 3, clock: null });
  });

  it('is unknown without any time evidence', () => {
    const unknown = candidate({ boardingTime: null, boardingTimeSource: 'unknown', estimatedWaitMinutes: null });
    expect(candidateDeparture(unknown, now)).toEqual({ kind: 'unknown' });
  });
});

describe('resolveViewedCandidate / followCandidate', () => {
  const planned = candidate({ selected: true });
  const other = candidate({ candidateId: 'TXG108|0|KKA-6317|1792661571000', routeName: '108' });

  it('defaults to the planned trip and honours an explicit view', () => {
    expect(resolveViewedCandidate([other, planned])).toBe(planned);
    expect(resolveViewedCandidate([other, planned], other.candidateId)).toBe(other);
    expect(resolveViewedCandidate([], other.candidateId)).toBeNull();
  });

  it('follows the same bus after its ETA (and so its id) moved', () => {
    const moved = { ...other, candidateId: 'TXG108|0|KKA-6317|1792661631000', boardingTime: '2026-10-22T17:33:51.000+08:00' };
    expect(followCandidate([planned, moved], other)).toBe(moved);
    expect(followCandidate([planned], other)).toBeUndefined();
  });
});

describe('busRouteNames', () => {
  it('lists each route once and falls back to the planned route', () => {
    const later5 = candidate({ candidateId: 'TXG5|1|x|2', boardingTime: '2026-10-22T17:50:00+08:00' });
    expect(busRouteNames(leg, [candidate({}), candidate({ routeName: '108' }), later5])).toEqual(['5', '108']);
    expect(busRouteNames(leg, [])).toEqual(['5']);
    expect(busRouteNames(leg)).toEqual(['5']);
  });
});
