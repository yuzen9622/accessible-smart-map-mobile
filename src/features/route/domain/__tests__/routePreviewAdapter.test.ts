// Web 版 routePreviewAdapter 沒有測試；本 repo 補上，守住 LINE 預覽 → 完整 RouteLeg 的欄位對應。
import type { RoutePreviewRoute } from '../../types/route';
import { adaptRoutePreviewRoutes } from '../routePreviewAdapter';

const polyline: [number, number][] = [
  [121.5, 25.0],
  [121.51, 25.01],
];

describe('adaptRoutePreviewRoutes', () => {
  it('fills required fields for every leg type and keeps geometry', () => {
    const route: RoutePreviewRoute = {
      routeName: '捷運＋步行',
      totalMinutes: 32,
      legs: [
        { type: 'WALK', from: '起點', to: '台北車站', durationMinutes: 5, distanceM: 400, polyline },
        { type: 'METRO', label: '板南線', from: '台北車站', to: '市政府', durationMin: 12, polyline },
        { type: 'BUS', from: 'A', to: 'B', departureTime: null },
        { type: 'DRIVE', durationMin: 9 },
      ],
    };
    const [adapted] = adaptRoutePreviewRoutes([route]);

    expect(adapted.routeId).toBe('line-preview-0');
    expect(adapted.transferCount).toBe(0);

    const [walk, metro, bus, drive] = adapted.legs;
    expect(walk).toMatchObject({ type: 'WALK', minutesEst: 5, distanceM: 400, polyline, a11yFacilities: [] });
    expect(metro).toMatchObject({ type: 'METRO', lineName: '板南線', rideMinutes: 12, polyline });
    expect(bus).toMatchObject({ type: 'BUS', routeName: '公車', departureTime: undefined, polyline: [] });
    expect(drive).toMatchObject({ type: 'DRIVE', label: '開車', durationMin: 9, durationMinutes: 9 });
  });

  it('only accepts known accessibility labels', () => {
    const base: RoutePreviewRoute = { routeName: 'r', totalMinutes: 1, legs: [] };
    const [known, unknown] = adaptRoutePreviewRoutes([
      { ...base, accessibilityLabel: 'good', accessibilityScore: 70 },
      { ...base, accessibilityLabel: '很好', accessibilityScore: null },
    ]);
    expect(known.accessibilityLabel).toBe('good');
    expect(known.accessibilityScore).toBe(70);
    expect(unknown.accessibilityLabel).toBeUndefined();
    expect(unknown.accessibilityScore).toBeUndefined();
    // 原始文字仍保留在亮點，讓使用者看得到後端給的描述。
    expect(unknown.accessibilityHighlights).toEqual(['很好']);
  });
});
