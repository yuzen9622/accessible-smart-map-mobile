import { shouldCollapseForPan, type ViewportSample } from '../panCollapse';

const start: ViewportSample = { center: [121.5, 25.04], zoom: 16, bounds: [121.49, 25.03, 121.51, 25.05] };

describe('shouldCollapseForPan', () => {
  it('小幅拖動不收合', () => {
    expect(shouldCollapseForPan(start, { ...start, center: [121.503, 25.041] })).toBe(false);
  });

  it('水平拖過四分之一個畫面就收合', () => {
    expect(shouldCollapseForPan(start, { ...start, center: [121.506, 25.04] })).toBe(true);
  });

  it('垂直拖動以畫面高度為尺度', () => {
    expect(shouldCollapseForPan(start, { ...start, center: [121.5, 25.034] })).toBe(true);
  });

  it('縮放一級以上也收合', () => {
    expect(shouldCollapseForPan(start, { ...start, zoom: 14.9 })).toBe(true);
    expect(shouldCollapseForPan(start, { ...start, zoom: 16.5 })).toBe(false);
  });

  it('範圍退化時不收合', () => {
    const degenerate: ViewportSample = { ...start, bounds: [121.5, 25.04, 121.5, 25.04] };
    expect(shouldCollapseForPan(degenerate, { ...degenerate, center: [121.6, 25.1] })).toBe(false);
  });
});
