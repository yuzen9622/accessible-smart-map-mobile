import type { BusLeg, RouteLeg, WalkLeg } from '../../types/route';
import { legChainSegments } from '../routeCard';

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
