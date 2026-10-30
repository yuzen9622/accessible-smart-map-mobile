import { createExpression, latest } from '@maplibre/maplibre-gl-style-spec';

import { ROUTE_CASING_PAINT, ROUTE_POINT_COLOR_PAINT, ROUTE_LINE_PAINT } from '../RouteLayer';
import { MODE, WALK_ROUTE, routeCasingColor } from '@/shared/theme/palettes';

jest.mock('../../store/routeSessionStore', () => ({ useRouteSessionStore: jest.fn() }));

function evaluate(value: unknown, spec: unknown, properties: Record<string, unknown>): string {
  const parsed = createExpression(value, spec as never);
  if (parsed.result !== 'success') throw new Error(JSON.stringify(parsed.value));
  return String(parsed.value.evaluate({ zoom: 14 }, { type: 'Point', properties } as never));
}

const casing = (properties: Record<string, unknown>) =>
  evaluate(ROUTE_CASING_PAINT?.['line-color'], latest.paint_line['line-color'], properties);
const fill = (properties: Record<string, unknown>) =>
  evaluate(ROUTE_POINT_COLOR_PAINT['circle-color'], latest.paint_circle['circle-color'], properties);
const stroke = (properties: Record<string, unknown>) =>
  evaluate(ROUTE_POINT_COLOR_PAINT['circle-stroke-color'], latest.paint_circle['circle-stroke-color'], properties);

const yellow = { color: '#FFDB00', casing: '#1A1A1A' };
const bus = { color: '#1B9A4B' };

it.each([
  { color: WALK_ROUTE.line, casing: WALK_ROUTE.casing },
  { color: WALK_ROUTE.sidewalk, casing: WALK_ROUTE.sidewalkCasing },
  ...Object.values(MODE).map(({ line: color }) => ({ color, casing: routeCasingColor(color) })),
  { color: '#FFDB00', casing: routeCasingColor('#FFDB00') },
])('uses the same opaque solid line and wider colored casing for every mode: %j', (properties) => {
  expect(evaluate(ROUTE_LINE_PAINT?.['line-color'], latest.paint_line['line-color'], properties))
    .toBe(evaluate(properties.color, latest.paint_line['line-color'], {}));
  expect(evaluate(ROUTE_CASING_PAINT?.['line-color'], latest.paint_line['line-color'], properties))
    .toBe(evaluate(properties.casing, latest.paint_line['line-color'], {}));
  expect(ROUTE_LINE_PAINT).not.toHaveProperty('line-dasharray');
  expect(ROUTE_LINE_PAINT).not.toHaveProperty('line-opacity');
  expect(ROUTE_CASING_PAINT).not.toHaveProperty('line-opacity');
  expect(Number(ROUTE_CASING_PAINT?.['line-width'])).toBeGreaterThan(Number(ROUTE_LINE_PAINT?.['line-width']));
});

it('uses a darker yellow metro outline and lighter green bus outline without changing the fills', () => {
  expect(casing({ kind: 'transit', color: yellow.color, casing: routeCasingColor(yellow.color) }))
    .toBe(evaluate('#736300', latest.paint_line['line-color'], {}));
  expect(casing({ kind: 'transit', ...bus, casing: routeCasingColor(bus.color) }))
    .toBe(evaluate(routeCasingColor(bus.color), latest.paint_line['line-color'], {}));
});

it('fills a coloured metro transfer point with the line colour and rings it in the ink', () => {
  expect(fill({ kind: 'transfer', ...yellow })).toBe(evaluate('#FFDB00', latest.paint_circle['circle-color'], {}));
  expect(stroke({ kind: 'transfer', ...yellow })).toBe(evaluate('#1A1A1A', latest.paint_circle['circle-stroke-color'], {}));
});

it('keeps the white transfer point with a line-colour ring for other lines', () => {
  expect(fill({ kind: 'transfer', ...bus })).toBe(evaluate('#FFFFFF', latest.paint_circle['circle-color'], {}));
  expect(stroke({ kind: 'transfer', ...bus })).toBe(evaluate('#1B9A4B', latest.paint_circle['circle-stroke-color'], {}));
});

it('leaves origin and other points as before', () => {
  expect(fill({ kind: 'origin', color: '#10B981' })).toBe(evaluate('#FFFFFF', latest.paint_circle['circle-color'], {}));
  expect(stroke({ kind: 'origin', color: '#10B981' })).toBe(evaluate('#10B981', latest.paint_circle['circle-stroke-color'], {}));
  expect(fill({ kind: 'waypoint', color: '#3B82F6' })).toBe(evaluate('#3B82F6', latest.paint_circle['circle-color'], {}));
  expect(stroke({ kind: 'waypoint', color: '#3B82F6' })).toBe(evaluate('#FFFFFF', latest.paint_circle['circle-stroke-color'], {}));
});
