import { createExpression, latest } from '@maplibre/maplibre-gl-style-spec';

import { MODE, TRAFFIC, WALK_ROUTE } from '@/shared/theme/palettes';
import { buildTrafficGradients } from '../routeTrafficGradient';
import type { AccessibleRoute, DriveLeg, DriveTrafficSegment, LngLatTuple } from '../../types/route';

const polyline: LngLatTuple[] = [[121, 25], [121.001, 25], [121.003, 25], [121.004, 25], [121.006, 25]];
const segment = (fromIndex: number, toIndex: number, trafficLevel: DriveTrafficSegment['trafficLevel']): DriveTrafficSegment =>
  ({ fromIndex, toIndex, trafficLevel, congestionLevel: 4 });
function build(trafficSegments: DriveTrafficSegment[] = [], overrides: Partial<DriveLeg> = {}) {
  const route: AccessibleRoute = {
    routeId: 'road', routeName: 'road', totalMinutes: 5, transferCount: 0, accessibilityHighlights: [],
    legs: [{ type: 'DRIVE', from: 'A', to: 'B', durationMin: 5, distanceM: 600, polyline, trafficSegments, ...overrides }],
  };
  return buildTrafficGradients(route);
}
function evaluate(gradient: unknown, progress: number) {
  const parsed = createExpression(gradient, 'line-gradient', latest.paint_line['line-gradient'] as never);
  if (parsed.result !== 'success') throw new Error(JSON.stringify(parsed.value));
  return String(parsed.value.evaluate({ zoom: 14, lineProgress: progress }));
}
const color = (value: string) => evaluate(value, 0);

it.each<DriveLeg['type']>(['DRIVE', 'MOTORCYCLE'])('%s blends blue/yellow/red along one full geometry, with synchronized lighter same-hue casing', (type) => {
  const [result] = build([segment(1, 2, 'moderate'), segment(2, 3, 'heavy')], { type });
  expect(result.data.geometry.coordinates).toEqual(polyline);
  for (const [progress, expected] of [[0, MODE.walk.line], [0.32, TRAFFIC.moderate], [0.58, TRAFFIC.heavy], [1, MODE.walk.line]] as const) {
    expect(evaluate(result.gradient, progress)).toBe(color(expected));
  }
  for (const [progress, expected] of [[0, WALK_ROUTE.casing], [0.32, '#FACC7E'], [0.58, '#F79C9C'], [1, WALK_ROUTE.casing]] as const) {
    expect(evaluate(result.casingGradient, progress)).toBe(color(expected));
  }
  const stops = (gradient: unknown) => (gradient as unknown[]).slice(3).filter((_, i) => i % 2 === 0);
  expect(stops(result.casingGradient)).toEqual(stops(result.gradient));
  for (const boundary of [1 / 6, 0.5, 2 / 3]) {
    const blended = evaluate(result.gradient, boundary);
    expect([MODE.walk.line, TRAFFIC.moderate, TRAFFIC.heavy].map(color)).not.toContain(blended);
    expect([WALK_ROUTE.casing, '#FACC7E', '#F79C9C'].map(color)).not.toContain(evaluate(result.casingGradient, boundary));
  }
});

it('keeps gaps blue and ignores unknown or invalid traffic ranges', () => {
  expect(build()).toEqual([]);
  expect(build([segment(0, 99, 'heavy'), segment(0, 2, 'unknown')])).toEqual([]);
  const [result] = build([segment(0, 1, 'moderate'), segment(3, 4, 'heavy')]);
  expect(evaluate(result.gradient, 0.4)).toBe(color(MODE.walk.line));
});

it('does not shift indexed traffic after invalid coordinates or emit zero-length gradients', () => {
  expect(build([segment(1, 2, 'heavy')], { polyline: [[NaN, 25], ...polyline.slice(1)] })).toEqual([]);
  expect(build([segment(0, 1, 'heavy')], { polyline: [[121, 25], [121, 25]] })).toEqual([]);
});

it('merges adjacent colors and preserves short segments with duplicate coordinates', () => {
  const [merged] = build([segment(0, 2, 'heavy'), segment(2, 4, 'heavy')]);
  expect(merged.gradient).toEqual(['interpolate', ['linear'], ['line-progress'], 0, TRAFFIC.heavy, 1, TRAFFIC.heavy]);
  const [short] = build([segment(1, 3, 'moderate')], { polyline: [[121, 25], [121.001, 25], [121.001, 25], [121.00101, 25], [121.002, 25]] });
  expect(evaluate(short.gradient, 0.5025)).toBe(color(TRAFFIC.moderate));
});

it('uses the later sorted overlay for overlapping reports and keeps endpoints colored', () => {
  const [result] = build([segment(0, 4, 'moderate'), segment(2, 4, 'heavy')]);
  expect(evaluate(result.gradient, 0)).toBe(color(TRAFFIC.moderate));
  expect(evaluate(result.gradient, 1)).toBe(color(TRAFFIC.heavy));
});
