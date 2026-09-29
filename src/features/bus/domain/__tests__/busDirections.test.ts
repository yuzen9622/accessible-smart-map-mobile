import type { RouteDetailDirection } from '../../types/transit';
import { defaultDirection, resolveDirectionLabels, stopsOfDirection } from '../busDirections';

const stop = (name: string) => ({ seq: 1, name, lat: 0, lng: 0, estimateMinutes: null, statusLabel: '' });
const dirs: RouteDetailDirection[] = [
  { direction: 0, stops: [stop('A'), stop('B')] },
  { direction: 1, stops: [stop('B'), stop('A')] },
];

describe('resolveDirectionLabels', () => {
  it('prefers the route own departure/destination', () => {
    expect(resolveDirectionLabels(dirs, { departure: 'X', destination: 'Y' })).toEqual({ destination: 'Y', departure: 'X' });
  });
  it('falls back to terminal stops', () => {
    expect(resolveDirectionLabels(dirs, {})).toEqual({ destination: 'B', departure: 'A' });
    expect(resolveDirectionLabels(dirs, { departure: '', destination: '' })).toEqual({ destination: 'B', departure: 'A' });
  });
  it('is empty without directions', () => {
    expect(resolveDirectionLabels([], {})).toEqual({ destination: '', departure: '' });
  });
});

describe('defaultDirection / stopsOfDirection', () => {
  it('picks 0, else the first available, else null', () => {
    expect(defaultDirection(dirs)).toBe(0);
    expect(defaultDirection([dirs[1]!])).toBe(1);
    expect(defaultDirection([])).toBeNull();
  });
  it('returns stops of a direction or empty', () => {
    expect(stopsOfDirection(dirs, 1).map((s) => s.name)).toEqual(['B', 'A']);
    expect(stopsOfDirection(dirs, null)).toEqual([]);
    expect(stopsOfDirection([dirs[0]!], 1)).toEqual([]);
  });
});
