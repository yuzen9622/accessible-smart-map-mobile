import { NAV_PEEK_DETENT, SHEET_DETENTS, sheetBottomInset, sheetConfig } from '../sheetInset';

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
  // detents 直接比對 SHEET_DETENTS 本身（不是寫死的數字），避免像先前那樣——peek 比例調整時
  // 這份測試沒跟著更新，壞測試留在 repo 裡沒人發現（2026-10-17 踩到）。
  it('一般頁面給 peek／half／full，落在 peek', () => {
    expect(sheetConfig(false, '/explore')).toEqual({ detents: [...SHEET_DETENTS], initialDetentIndex: 0 });
  });

  it('地點／設施詳情給 peek／half／full，落在 half（full 讓內容能正常滑動）', () => {
    for (const path of ['/loc/25.04,121.51', '/place/osm:1', '/facility/abc']) {
      expect(sheetConfig(false, path)).toEqual({ detents: [...SHEET_DETENTS], initialDetentIndex: 1 });
    }
  });

  it('回報詳情從首頁 peek 開啟時升到 half，並保留 full 供照片與內容捲動', () => {
    expect(sheetConfig(false, '/hazard/report-id')).toEqual({ detents: [...SHEET_DETENTS], initialDetentIndex: 1 });
    expect(sheetConfig(true, '/hazard/report-id')).toEqual({ detents: [NAV_PEEK_DETENT, 0.5], initialDetentIndex: 0 });
  });

  it('導航中用較低的 peek、不給 full，落在 peek', () => {
    expect(sheetConfig(true, '/loc/1,2')).toEqual({ detents: [NAV_PEEK_DETENT, 0.5], initialDetentIndex: 0 });
  });
});
