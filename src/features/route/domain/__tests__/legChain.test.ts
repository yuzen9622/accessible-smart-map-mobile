import type { BusLeg, RouteLeg, WalkLeg } from '../../types/route';
import { legChainSegments, legTimelineSegments, shortMetroLabel } from '../routeCard';

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
