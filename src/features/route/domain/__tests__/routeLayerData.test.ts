// 移植自 Web `src/components/Wrapper/__tests__/RouteWrapper.test.tsx`（commit 5eadc71）的行為：
// Web 斷言 renderToStaticMarkup 產生的 Polyline／Marker id；原生改斷言 GeoJSON feature。
import { buildRouteLayerData } from '../routeLayerData';
import { TRAFFIC_BASE_COLOR, TRAFFIC_LEVEL_COLORS } from '../routeDisplay';
import type { AccessibleRoute, DriveLeg, LngLatTuple, WalkLeg } from '../../types/route';

const DRIVE_POLYLINE: LngLatTuple[] = [
  [121.5, 25.03],
  [121.505, 25.031],
  [121.51, 25.032],
  [121.515, 25.033],
  [121.52, 25.034],
];

function driveRoute(overrides: Partial<DriveLeg> = {}): AccessibleRoute {
  return {
    routeId: 'd1',
    routeName: 'drive',
    totalMinutes: 10,
    transferCount: 0,
    accessibilityHighlights: [],
    legs: [{ type: 'DRIVE', from: 'A', to: 'B', distanceM: 2000, durationMin: 10, polyline: DRIVE_POLYLINE, ...overrides }],
  };
}

function ids(route: AccessibleRoute) {
  const data = buildRouteLayerData(route);
  return {
    lines: data.lines.features.map((f) => f.properties.id),
    points: data.points.features.map((f) => f.properties),
  };
}

describe('buildRouteLayerData', () => {
  it('returns empty collections without a route', () => {
    const data = buildRouteLayerData(null);
    expect(data.lines.features).toHaveLength(0);
    expect(data.points.features).toHaveLength(0);
  });

  it('draws only the plain base line when no traffic segments are present', () => {
    const { lines } = ids(driveRoute());
    expect(lines).toEqual(['leg-0']);
  });

  it('draws the solid base line plus one line per visible segment, sorted by fromIndex', () => {
    const { lines } = ids(
      driveRoute({
        trafficSegments: [
          { fromIndex: 2, toIndex: 4, trafficLevel: 'severe', congestionLevel: 5 },
          { fromIndex: 0, toIndex: 1, trafficLevel: 'heavy', congestionLevel: 4 },
        ],
      }),
    );
    expect(lines).toEqual(['leg-0', 'leg-0-traffic-heavy-0-1-0', 'leg-0-traffic-severe-2-4-1']);
  });

  it('skips out-of-range and unknown segments', () => {
    const { lines } = ids(
      driveRoute({
        trafficSegments: [
          { fromIndex: 0, toIndex: 99, trafficLevel: 'heavy', congestionLevel: 4 },
          { fromIndex: 1, toIndex: 3, trafficLevel: 'unknown', congestionLevel: 0 },
        ],
      }),
    );
    expect(lines).toEqual(['leg-0']);
  });

  it('places an incident marker at the reported coordinate', () => {
    const { points } = ids(
      driveRoute({
        incidents: [{ incidentId: 'inc-1', title: '塔城路封閉', severity: 'closure', location: { lat: 25.032, lng: 121.51 } }],
      }),
    );
    const incident = points.find((p) => p.id === 'leg-0-incident-inc-1');
    expect(incident).toMatchObject({ kind: 'incidentClosure', label: '塔城路封閉' });
    const feature = buildRouteLayerData(
      driveRoute({
        incidents: [{ incidentId: 'inc-1', title: '塔城路封閉', severity: 'closure', location: { lat: 25.032, lng: 121.51 } }],
      }),
    ).points.features.find((f) => f.properties.id === 'leg-0-incident-inc-1');
    expect(feature?.geometry.coordinates).toEqual([121.51, 25.032]);
  });

  it('draws the incident extent from points and treats roadClosed as a closure', () => {
    const data = buildRouteLayerData(
      driveRoute({
        incidents: [
          {
            incidentId: 'inc-2',
            title: '人行道更新',
            severity: 'advisory',
            roadClosed: true,
            location: { lat: 25.032, lng: 121.51 },
            points: [[121.51, 25.032], [121.5102, 25.0322]],
          },
        ],
      }),
    );
    const extent = data.lines.features.find((f) => f.properties.id === 'leg-0-incident-extent-inc-2');
    expect(extent?.properties.kind).toBe('incident');
    expect(data.points.features.find((f) => f.properties.id === 'leg-0-incident-inc-2')?.properties.kind).toBe('incidentClosure');
  });

  it('skips incidents without a numeric coordinate or farther than 150 m', () => {
    const { points } = ids(
      driveRoute({
        incidents: [
          { incidentId: 'bad', title: '緯度遺失', severity: 'advisory', location: { lat: Number.NaN, lng: 121.52 } },
          { incidentId: 'far', title: '台中遠方施工', severity: 'advisory', location: { lat: 24.145, lng: 120.694 } },
        ],
      }),
    );
    expect(points.some((p) => p.kind === 'incidentAdvisory')).toBe(false);
  });

  it('exposes both the dimmed base colour and the segment colours', () => {
    expect(TRAFFIC_BASE_COLOR).toBe('#475569');
    expect(TRAFFIC_LEVEL_COLORS.severe).not.toBe(TRAFFIC_LEVEL_COLORS.heavy);
  });

  it('marks origin, destination and a transfer where the leg type changes', () => {
    const walk: WalkLeg = {
      type: 'WALK',
      from: 'A',
      to: 'B',
      distanceM: 100,
      minutesEst: 2,
      polyline: [
        [121.49, 25.02],
        [121.5, 25.03],
      ],
      a11yFacilities: [],
      a11ySegments: [
        { feature: 'elevator', startIndex: 1, endIndex: 1, indoor: true, distanceM: null, maxSlopePercent: null, minWidthCm: null },
        { feature: 'ramp', startIndex: 0, endIndex: 1, indoor: false, distanceM: 10, maxSlopePercent: 5, minWidthCm: 120 },
      ],
    };
    const route: AccessibleRoute = { ...driveRoute(), legs: [walk, ...driveRoute().legs] };
    const data = buildRouteLayerData(route, [{ lat: 25.031, lng: 121.505 }]);
    const kinds = data.points.features.map((f) => f.properties.kind);
    expect(kinds).toEqual(['a11yDot', 'transfer', 'waypoint', 'origin', 'destination']);
    expect(data.points.features.find((f) => f.properties.kind === 'origin')?.geometry.coordinates).toEqual([121.49, 25.02]);
    expect(data.points.features.find((f) => f.properties.kind === 'destination')?.geometry.coordinates).toEqual([121.52, 25.034]);
    expect(data.lines.features.map((f) => f.properties.kind)).toEqual(['walk', 'a11y', 'drive']);
  });
});
