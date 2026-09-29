import { SHEET_DETENTS, sheetBottomInset, sheetConfig } from '../sheetInset';

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

describe('sheetConfig', () => {
  it('一般頁面給 peek／half／full，落在 peek', () => {
    expect(sheetConfig(false, '/explore')).toEqual({ detents: [0.15, 0.5, 1], initialDetentIndex: 0 });
  });

  it('地點／設施詳情不給 full，直接落在 half', () => {
    for (const path of ['/loc/25.04,121.51', '/place/osm:1', '/facility/abc']) {
      expect(sheetConfig(false, path)).toEqual({ detents: [0.15, 0.5], initialDetentIndex: 1 });
    }
  });

  it('導航中不給 full，落在 peek', () => {
    expect(sheetConfig(true, '/loc/1,2')).toEqual({ detents: [0.15, 0.5], initialDetentIndex: 0 });
  });
});
