import { contrastRatio } from '../contrast';
import { FACILITY, FEATURE, MODE, type DomainColor } from '../palettes';

const WHITE = '#FFFFFF';

describe.each([
  ['MODE', MODE],
  ['FACILITY', FACILITY],
  ['FEATURE', FEATURE],
] as [string, Record<string, DomainColor>][])('%s', (_name, palette) => {
  it.each(Object.entries(palette))('%s: text 對白底 ≥ 4.5:1，line 對白色圖示 ≥ 3:1', (_key, color) => {
    expect(contrastRatio(color.text, WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(color.line, WHITE)).toBeGreaterThanOrEqual(3);
  });
});
