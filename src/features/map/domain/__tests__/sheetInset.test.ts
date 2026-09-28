import { SHEET_DETENTS, sheetBottomInset } from '../sheetInset';

describe('sheetBottomInset', () => {
  it('peek 與 half 依比例計算', () => {
    expect(sheetBottomInset(0, 1000)).toBe(Math.round(SHEET_DETENTS[0] * 1000));
    expect(sheetBottomInset(1, 1000)).toBe(500);
  });

  it('full 沿用 half；超出範圍的 index 被 clamp', () => {
    expect(sheetBottomInset(2, 1000)).toBe(500);
    expect(sheetBottomInset(-1, 1000)).toBe(Math.round(SHEET_DETENTS[0] * 1000));
    expect(sheetBottomInset(9, 1000)).toBe(500);
  });
});
