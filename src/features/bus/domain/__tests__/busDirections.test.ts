import type { RouteDetailDirection } from '../../types/transit';
import { defaultDirection, resolveDirectionLabels, routePathOfDirection, stopsOfDirection } from '../busDirections';

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

describe('routePathOfDirection', () => {
  const at = (name: string, lng: number, lat: number) => ({ ...stop(name), lng, lat });
  const shaped: RouteDetailDirection[] = [
    {
      direction: 0,
      stops: [at('A', 121.5, 25), at('B', 121.6, 25.1)],
      polyline: [
        [121.5, 25],
        [121.55, 25.02],
        [121.6, 25.1],
      ],
    },
    { direction: 1, stops: [at('B', 121.6, 25.1), at('A', 121.5, 25)] },
  ];

  it('uses the backend shape when present', () => {
    expect(routePathOfDirection(shaped, 0)).toEqual([
      [121.5, 25],
      [121.55, 25.02],
      [121.6, 25.1],
    ]);
  });
  it('falls back to joining stops in order', () => {
    expect(routePathOfDirection(shaped, 1)).toEqual([
      [121.6, 25.1],
      [121.5, 25],
    ]);
  });
  it('is empty without a direction', () => {
    expect(routePathOfDirection(shaped, null)).toEqual([]);
    expect(routePathOfDirection([shaped[0]!], 1)).toEqual([]);
  });
});
