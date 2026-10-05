import { buildCumulativePath, type BusLeg, type NavInstruction, type RouteLeg } from '@/features/route/domain';

import { transitHeadline, transitInstruction, transitLiveText, type Translate } from '../transitCopy';
import {
  findActiveBusRun,
  hasBoarded,
  plannedRideMinutes,
  rideStops,
  stopsAhead,
  transitAnnouncement,
  type TransitGuide,
} from '../transitRide';

function step(type: NavInstruction['type'], legType: NavInstruction['legType'], legIndex?: number): NavInstruction {
  return { text: '', type, bearing: null, relativeDirection: null, distanceM: null, streetName: null, legType, legIndex, polylineIndex: null };
}

const busLeg = (overrides: Partial<BusLeg> = {}): BusLeg =>
  ({
    type: 'BUS',
    routeName: '307',
    departureStop: 'A',
    arrivalStop: 'D',
    direction: 0,
    waitInfo: { time: null, source: 'unavailable' },
    estimatedWaitMinutes: 0,
    polyline: [
      [121.5, 25],
      [121.51, 25],
    ],
    departureStopA11y: [],
    arrivalStopA11y: [],
    intermediateStops: [
      { name: 'B', location: [121.503, 25] },
      { name: 'C', location: [121.506, 25] },
    ],
    ...overrides,
  }) as BusLeg;

describe('findActiveBusRun', () => {
  const instructions = [
    step('depart', 'WALK', 0),
    step('transit_board', 'BUS', 1),
    step('transit_alight', 'BUS', 1),
    step('turn', 'WALK', 2),
    step('transit_board', 'BUS', 3),
    step('transit_alight', 'BUS', 3),
    step('arrive', 'WALK', 4),
  ];

  it('returns the run being ridden, else the next one ahead', () => {
    expect(findActiveBusRun(instructions, 0)).toEqual({ ordinal: 0, boardIndex: 1, alightIndex: 2, legIndex: 1 });
    expect(findActiveBusRun(instructions, 2)).toEqual({ ordinal: 0, boardIndex: 1, alightIndex: 2, legIndex: 1 });
    expect(findActiveBusRun(instructions, 3)).toEqual({ ordinal: 1, boardIndex: 4, alightIndex: 5, legIndex: 3 });
    expect(findActiveBusRun(instructions, 6)).toBeNull();
  });

  it('does not guess when the run is not a board → alight pair', () => {
    expect(findActiveBusRun([step('depart', 'WALK', 0), step('turn', 'BUS', 1), step('transit_alight', 'BUS', 1)], 0)).toBeNull();
    expect(findActiveBusRun([step('transit_board', 'BUS'), step('transit_alight', 'BUS')], 0)).toBeNull();
    expect(findActiveBusRun([step('transit_board', 'BUS', 1)], 0)).toBeNull();
  });
});

describe('hasBoarded', () => {
  it('needs both distance past the stop and vehicle speed, or a long way along the route', () => {
    expect(hasBoarded(60, 1.2)).toBe(false);
    expect(hasBoarded(40, 10)).toBe(false);
    expect(hasBoarded(60, 5)).toBe(true);
    expect(hasBoarded(60, null)).toBe(false);
    expect(hasBoarded(220, null)).toBe(true);
  });
});

describe('rideStops / stopsAhead', () => {
  const cp = buildCumulativePath([busLeg() as RouteLeg]);

  it('orders the intermediate stops and the alighting stop along the leg', () => {
    const stops = rideStops(busLeg(), cp, 0);
    expect(stops?.map((s) => s.name)).toEqual(['B', 'C', 'D']);
    expect(stopsAhead(stops ?? [], 0)).toMatchObject({ count: 3, next: { name: 'B' } });
    // 剛到 B 站（30 m 內）就算過了這一站。
    expect(stopsAhead(stops ?? [], (stops?.[0].alongM ?? 0) - 20).count).toBe(2);
  });

  it('refuses to count stops when one has no location', () => {
    expect(rideStops(busLeg({ intermediateStops: [{ name: 'B' }, { name: 'C', location: [121.506, 25] }] }), cp, 0)).toBeNull();
  });
});

describe('plannedRideMinutes', () => {
  it('prefers rideMinutes, falls back to the timetable across midnight', () => {
    expect(plannedRideMinutes(busLeg({ rideMinutes: 18 }))).toBe(18);
    expect(plannedRideMinutes(busLeg({ departureTime: '23:50', arrivalTime: '00:05' }))).toBe(15);
    expect(plannedRideMinutes(busLeg())).toBeNull();
  });
});

describe('transitAnnouncement', () => {
  const waiting = (waitMinutes: number | null): TransitGuide => ({ phase: 'waiting', routeName: '307', boardStop: 'A', waitMinutes });
  const riding = (stopsLeft: number | null): TransitGuide => ({
    phase: 'riding',
    routeName: '307',
    alightStop: 'D',
    stopsLeft,
    minutes: 6,
    minutesSource: 'estimated',
  });

  it('arriving at the stop with the bus already close covers the "soon" reminder', () => {
    const result = transitAnnouncement(null, waiting(2), new Set());
    expect(result.speech).toMatchObject({ kind: 'atStop', waitMinutes: 2 });
    expect(result.remember).toEqual(['soon']);
    expect(transitAnnouncement(waiting(2), waiting(2), new Set(result.remember)).speech).toBeNull();
  });

  it('does not repeat while the minutes tick down, and says nothing for unknown minutes', () => {
    expect(transitAnnouncement(waiting(7), waiting(6), new Set()).speech).toBeNull();
    expect(transitAnnouncement(waiting(7), waiting(null), new Set()).speech).toBeNull();
  });

  it('announces each stop while riding and the last one as "get ready"', () => {
    expect(transitAnnouncement(riding(3), riding(3), new Set()).speech).toBeNull();
    expect(transitAnnouncement(riding(3), riding(2), new Set()).speech).toMatchObject({ kind: 'stopsLeft', stopsLeft: 2 });
    expect(transitAnnouncement(riding(2), riding(1), new Set()).speech).toEqual({ kind: 'nextStopAlight', alightStop: 'D' });
  });
});

describe('transit copy', () => {
  const t: Translate = (key, options) => (options ? `${key}${JSON.stringify(options)}` : key);

  it('shows minutes / arriving / unknown while waiting, and stops left while riding', () => {
    const wait = (waitMinutes: number | null, phase: 'waiting' | 'approaching' = 'waiting'): TransitGuide => ({
      phase,
      routeName: '307',
      boardStop: 'A',
      waitMinutes,
    });
    expect(transitHeadline(t, wait(5))).toBe('navBusWaitMinutes{"count":5}');
    expect(transitHeadline(t, wait(1))).toBe('navBusArrivingSoon');
    expect(transitHeadline(t, wait(0))).toBe('navBusArrivingNow');
    expect(transitHeadline(t, wait(null))).toBe('navBusWaitUnknown');
    expect(transitHeadline(t, wait(5, 'approaching'))).toBeNull();
    const ride: TransitGuide = { phase: 'riding', routeName: '307', alightStop: 'D', stopsLeft: 3, minutes: 7, minutesSource: 'realtime' };
    expect(transitHeadline(t, ride)).toBe('navBusStopsLeft{"count":3}');
    expect(transitInstruction(t, ride)).toBe('navBusRideInstruction{"count":7,"stop":"D"}');
    expect(transitInstruction(t, { ...ride, stopsLeft: 1 })).toBe('navBusNextStopAlight{"stop":"D"}');
    expect(transitLiveText(t, ride)).toBe('navBusStopsLeft{"count":3} · navBusRideInstruction{"count":7,"stop":"D"}');
  });
});
