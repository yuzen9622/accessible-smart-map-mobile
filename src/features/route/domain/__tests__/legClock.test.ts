import { computeLegClock, nowClockMinutes } from '../legClock';
import type { BusLeg, MetroLeg, RouteLeg, WalkLeg } from '../../types/route';

const walk = (minutesEst: number): WalkLeg => ({
  type: 'WALK',
  from: '',
  to: '',
  distanceM: 0,
  minutesEst,
  polyline: [],
  a11yFacilities: [],
});

const bus = (overrides: Partial<BusLeg> = {}): BusLeg => ({
  type: 'BUS',
  routeName: '651副',
  departureStop: 'A',
  arrivalStop: 'B',
  waitInfo: { time: null, source: 'unavailable' },
  estimatedWaitMinutes: 0,
  direction: 0,
  polyline: [],
  departureStopA11y: [],
  arrivalStopA11y: [],
  ...overrides,
});

const metro = (overrides: Partial<MetroLeg> = {}): MetroLeg => ({
  type: 'METRO',
  railSystem: 'TRTC',
  lineId: 'BL',
  lineName: '板南線',
  lineUid: '',
  departureStation: '',
  arrivalStation: '',
  departureStationUid: '',
  arrivalStationUid: '',
  direction: 0,
  stopsCount: 1,
  rideMinutes: 5,
  waitInfo: { time: null, source: 'unavailable' },
  estimatedWaitMinutes: 0,
  polyline: [],
  departureStationA11y: [],
  arrivalStationA11y: [],
  facilityHighlights: [],
  ...overrides,
});

describe('computeLegClock', () => {
  it('accumulates estimated minutes across legs with no real clock data', () => {
    const legs: RouteLeg[] = [walk(4), walk(2)];
    expect(computeLegClock(legs, 10 * 60)).toEqual([
      { departureLabel: '10:00', arrivalLabel: '10:04' },
      { departureLabel: '10:04', arrivalLabel: '10:06' },
    ]);
  });

  it('uses the real departure/arrival time on a transit leg and resyncs the cursor', () => {
    const legs: RouteLeg[] = [walk(4), bus({ departureTime: '14:39', arrivalTime: '14:41' }), walk(1)];
    expect(computeLegClock(legs, 14 * 60 + 37)).toEqual([
      { departureLabel: '14:37', arrivalLabel: '14:41' },
      { departureLabel: '14:39', arrivalLabel: '14:41' },
      { departureLabel: '14:41', arrivalLabel: '14:42' },
    ]);
  });

  it('falls back to estimated duration when departureTime/arrivalTime are missing', () => {
    const legs: RouteLeg[] = [bus({ rideMinutes: 6 })];
    expect(computeLegClock(legs, 10 * 60)).toEqual([{ departureLabel: '10:00', arrivalLabel: '10:06' }]);
  });

  it('falls back to estimated duration when the real clock strings are malformed', () => {
    const legs: RouteLeg[] = [metro({ departureTime: 'bogus', arrivalTime: 'bogus', rideMinutes: 7 })];
    expect(computeLegClock(legs, 9 * 60)).toEqual([{ departureLabel: '09:00', arrivalLabel: '09:07' }]);
  });

  it('wraps past midnight', () => {
    const legs: RouteLeg[] = [walk(90)];
    expect(computeLegClock(legs, 23 * 60)).toEqual([{ departureLabel: '23:00', arrivalLabel: '00:30' }]);
  });

  it('handles an empty route', () => {
    expect(computeLegClock([], 0)).toEqual([]);
  });
});

describe('nowClockMinutes', () => {
  it('reads hours and minutes from a Date', () => {
    expect(nowClockMinutes(new Date(2026, 0, 1, 9, 5))).toBe(9 * 60 + 5);
    expect(nowClockMinutes(new Date(2026, 0, 1, 23, 59))).toBe(23 * 60 + 59);
  });
});
