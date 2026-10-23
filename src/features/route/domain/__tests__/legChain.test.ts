import type { BusLeg, RouteLeg, WalkLeg } from '../../types/route';
import { firstBoarding, legChainSegments, legTimelineSegments, localizedDuration, shortMetroLabel } from '../routeCard';

const walk: WalkLeg = { type: 'WALK', from: '', to: '', distanceM: 0, minutesEst: 0, polyline: [], a11yFacilities: [] };
const bus: BusLeg = {
  type: 'BUS',
  routeName: '28',
  departureStop: 'A',
  arrivalStop: 'B',
  waitInfo: { time: null, source: 'unavailable' },
  estimatedWaitMinutes: 0,
  direction: 0,
  polyline: [],
  departureStopA11y: [],
  arrivalStopA11y: [],
};

describe('legChainSegments', () => {
  it('merges consecutive walks and labels transit with its route number', () => {
    const legs: RouteLeg[] = [walk, walk, bus, walk];
    expect(legChainSegments(legs)).toEqual([{ type: 'WALK' }, { type: 'BUS', label: '28' }, { type: 'WALK' }]);
  });

  it('keeps separate walks around a transit leg', () => {
    expect(legChainSegments([walk, bus, walk, walk]).map((s) => s.type)).toEqual(['WALK', 'BUS', 'WALK']);
  });

  it('handles an empty route', () => {
    expect(legChainSegments([])).toEqual([]);
  });
});

describe('legTimelineSegments', () => {
  const walkA: WalkLeg = { ...walk, distanceM: 350, minutesEst: 4.2 };
  const walkB: WalkLeg = { ...walk, distanceM: 150, minutesEst: 1.6 };
  const rideBus: BusLeg = { ...bus, routeName: '651副', rideMinutes: 5.8 };

  it('sums distance and duration across merged consecutive walks', () => {
    const legs: RouteLeg[] = [{ ...walk, distanceM: 100, minutesEst: 1 }, { ...walk, distanceM: 250, minutesEst: 3 }, rideBus, walkB];
    expect(legTimelineSegments(legs)).toEqual([
      { type: 'WALK', durationMinutes: 4, distanceM: 350 },
      { type: 'BUS', label: '651副', durationMinutes: 6 },
      { type: 'WALK', durationMinutes: 2, distanceM: 150 },
    ]);
  });

  it('rounds each leg duration and keeps the transit label', () => {
    expect(legTimelineSegments([walkA, rideBus, walkB])).toEqual([
      { type: 'WALK', durationMinutes: 4, distanceM: 350 },
      { type: 'BUS', label: '651副', durationMinutes: 6 },
      { type: 'WALK', durationMinutes: 2, distanceM: 150 },
    ]);
  });

  it('treats a missing bus rideMinutes as 0', () => {
    expect(legTimelineSegments([{ ...bus, rideMinutes: undefined }])).toEqual([{ type: 'BUS', label: '28', durationMinutes: 0 }]);
  });

  it('handles an empty route', () => {
    expect(legTimelineSegments([])).toEqual([]);
  });
});

describe('shortMetroLabel', () => {
  it('keeps short line names', () => {
    expect(shortMetroLabel('板南線', 'BL')).toBe('板南線');
  });

  it('names Taipei Metro lines the way riders know them', () => {
    expect(shortMetroLabel('南港展覽館－亞東醫院', 'BL')).toBe('板南線');
    expect(shortMetroLabel('南港展覽館－亞東醫院', 'TRTC_BL', 'TRTC')).toBe('板南線');
    expect(shortMetroLabel('南港展覽館－亞東醫院', 'BL', 'metro')).toBe('板南線');
  });

  it('does not apply Taipei names to other metro systems', () => {
    expect(shortMetroLabel('高雄國際機場－南岡山', 'R', 'KRTC')).toBe('R');
  });

  it('falls back to the first terminus without a usable id', () => {
    expect(shortMetroLabel('南港展覽館－亞東醫院', '')).toBe('南港展覽館');
    expect(shortMetroLabel('南港展覽館－亞東醫院', 'TRTC-BL-LONG-ID')).toBe('南港展覽館');
  });
});

describe('bus departure candidates on the route card', () => {
  const now = Date.parse('2026-10-22T17:22:51+08:00');
  const live = {
    candidateId: '28|0|P|1', routeName: '28', subRouteUid: 'U28', direction: 0 as const, departureStopId: 'A', arrivalStopId: 'B',
    estimatedWaitMinutes: 99, boardingTime: '2026-10-22T17:30:51+08:00', alightingTime: '2026-10-22T17:40:51+08:00',
    boardingTimeSource: 'realtime' as const, alightingTimeSource: 'realtime' as const,
    vehicleAccessibility: 'unknown' as const, hasLiftOrRamp: null, selected: true,
  };
  const withCandidates: BusLeg = {
    ...bus,
    fromDisplayName: 'Stop A',
    departureTime: '17:31',
    departureCandidates: [live, { ...live, candidateId: '108|0|Q|2', routeName: '108', selected: false }, { ...live, candidateId: '28|0|R|3', selected: false }],
  };

  it('marks other routes serving the same stop pair, once each, without the planned one', () => {
    expect(legChainSegments([walk, withCandidates])).toEqual([{ type: 'WALK' }, { type: 'BUS', label: '28', alternatives: ['108'] }]);
  });

  it('counts the planned bus down from its boarding time', () => {
    expect(firstBoarding([walk, withCandidates], now)).toEqual({ stop: 'Stop A', departure: { kind: 'live', minutes: 8, clock: '17:30' } });
  });

  it('stops claiming the planned bus is coming once it has left', () => {
    const later = now + 10 * 60_000;
    expect(firstBoarding([walk, withCandidates], later)).toEqual({ stop: 'Stop A', departure: { kind: 'unknown' } });
    // 剛到站的一分鐘內仍算「即將抵達」
    expect(firstBoarding([walk, withCandidates], Date.parse('2026-10-22T17:31:30+08:00'))?.departure).toEqual({ kind: 'live', minutes: 0, clock: '17:30' });
  });

  it('falls back to the scheduled clock without candidates, and to null without transit', () => {
    expect(firstBoarding([walk, { ...bus, departureTime: '17:31' }], now)).toEqual({ stop: 'A', departure: { kind: 'scheduled', clock: '17:31' } });
    expect(firstBoarding([walk], now)).toBeNull();
  });

  it('localises durations through the translator', () => {
    const t = (key: string, options?: Record<string, unknown>) => `${key}:${JSON.stringify(options)}`;
    expect(localizedDuration(17.4, t)).toBe('nativeRouteMinutes:{"count":17}');
    expect(localizedDuration(65, t)).toBe('nativeRouteHoursMinutes:{"hours":1,"minutes":5}');
  });
});
