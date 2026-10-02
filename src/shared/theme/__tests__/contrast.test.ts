import { Colors } from '../colors';
import { contrastRatio, hexToRgb, relativeLuminance } from '../contrast';
import { semanticColors } from '../tokens';

describe('relativeLuminance / contrastRatio（WCAG 公式）', () => {
  it('黑白對比為 21:1（公式已知上界）', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  it('相同顏色對比為 1:1', () => {
    expect(contrastRatio('#3C3F45', '#3C3F45')).toBeCloseTo(1, 5);
  });

  it('順序不影響結果', () => {
    expect(contrastRatio('#000000', '#B0B4BA')).toBeCloseTo(contrastRatio('#B0B4BA', '#000000'), 10);
  });

  it('relativeLuminance 對純白回傳 1，純黑回傳 0', () => {
    expect(relativeLuminance(hexToRgb('#FFFFFF'))).toBeCloseTo(1, 5);
    expect(relativeLuminance(hexToRgb('#000000'))).toBeCloseTo(0, 5);
  });

  it('拒絕非 6 碼 hex', () => {
    expect(() => hexToRgb('#fff')).toThrow();
    expect(() => hexToRgb('not-a-color')).toThrow();
  });
});

describe('色票對比門檻（text/textSecondary vs background）', () => {
  const normalVariants: (keyof typeof Colors)[] = ['light', 'dark'];
  const highContrastVariants: (keyof typeof Colors)[] = ['light-hc', 'dark-hc'];

  it.each(normalVariants)('%s：text 對 background ≥ 4.5:1', (variant) => {
    const { text, background } = Colors[variant];
    expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(normalVariants)('%s：textSecondary 對 background ≥ 4.5:1', (variant) => {
    const { textSecondary, background } = Colors[variant];
    expect(contrastRatio(textSecondary, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(highContrastVariants)('%s：text 對 background ≥ 7:1', (variant) => {
    const { text, background } = Colors[variant];
    expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(7);
  });

  it.each(highContrastVariants)('%s：textSecondary 對 background ≥ 7:1', (variant) => {
    const { textSecondary, background } = Colors[variant];
    expect(contrastRatio(textSecondary, background)).toBeGreaterThanOrEqual(7);
  });
});

describe('語意色對比門檻（semanticColors）', () => {
  const tones = ['ok', 'warn', 'danger', 'neutral'] as const;
  const cases = [
    { name: 'light', dark: false, hc: false, variant: 'light', min: 4.5 },
    { name: 'dark', dark: true, hc: false, variant: 'dark', min: 4.5 },
    { name: 'light-hc', dark: false, hc: true, variant: 'light-hc', min: 7 },
    { name: 'dark-hc', dark: true, hc: true, variant: 'dark-hc', min: 7 },
  ] as const;

  it.each(cases)('$name：accent 與各語意前景色對 background ≥ 門檻', ({ dark, hc, variant, min }) => {
    const palette = semanticColors(dark, hc);
    const { background } = Colors[variant];
    expect(contrastRatio(palette.accent, background)).toBeGreaterThanOrEqual(min);
    for (const tone of tones) expect(contrastRatio(palette[tone].fg, background)).toBeGreaterThanOrEqual(min);
  });

  it.each(cases.filter((c) => c.hc))('$name：高對比語意前景色對 backgroundElement 也 ≥ 7:1', ({ dark, hc, variant }) => {
    const palette = semanticColors(dark, hc);
    const { backgroundElement } = Colors[variant];
    expect(contrastRatio(palette.accent, backgroundElement)).toBeGreaterThanOrEqual(7);
    for (const tone of tones) expect(contrastRatio(palette[tone].fg, backgroundElement)).toBeGreaterThanOrEqual(7);
  });
});
