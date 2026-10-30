import { contrastRatio } from '../contrast';
import { METRO_LINE_FILL, MODE, TRAFFIC, WALK_ROUTE, WHITE, routeCasingColor } from '../palettes';

const fills = [...new Set([...Object.values(MODE).map((mode) => mode.line), ...Object.values(METRO_LINE_FILL), ...Object.values(TRAFFIC)])];

it('keeps the established blue walking outline when deriving same-hue outlines', () => {
  expect(routeCasingColor(MODE.walk.line)).toBe(WALK_ROUTE.casing);
});

it.each(fills)('%s stays distinct from its casing and visible on light/dark map baselines', (fill) => {
  const casing = routeCasingColor(fill);
  expect(contrastRatio(fill, casing)).toBeGreaterThanOrEqual(1.5);
  for (const background of [WHITE, '#121212']) {
    expect(Math.max(contrastRatio(fill, background), contrastRatio(casing, background))).toBeGreaterThanOrEqual(3);
  }
  if (contrastRatio(fill, WHITE) < 3) expect(contrastRatio(fill, casing)).toBeGreaterThanOrEqual(3);
});
