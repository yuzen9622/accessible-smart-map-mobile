// 移植自 Web `src/components/Wrapper/__tests__/RouteWrapper.test.tsx`（commit 5eadc71）的行為：
// Web 斷言 renderToStaticMarkup 產生的 Polyline／Marker id；原生改斷言 GeoJSON feature。
import { buildAlternativeRouteLines, buildRouteLayerData } from '../routeLayerData';
import { TRAFFIC_BASE_COLOR, TRAFFIC_LEVEL_COLORS } from '../routeDisplay';
import { MODE, WALK_ROUTE, routeCasingColor } from '@/shared/theme/palettes';
import { adaptRoutePreviewRoutes } from '../routePreviewAdapter';
import { createRouteReveal } from '../routeReveal';
import type { AccessibleRoute, DriveLeg, LngLatTuple, MetroLeg, RouteLeg, WalkLeg } from '../../types/route';
import { routePlanFixture } from '@/features/ai/domain/testing/routePlanFixture';

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

describe('alternative route lines', () => {
  it.each(['walk', 'drive', 'motorcycle'] as const)('draws unselected base geometry only in %s mode', (mode) => {
    const other = { ...driveRoute({
      type: mode === 'motorcycle' ? 'MOTORCYCLE' : 'DRIVE',
      trafficSegments: [{ fromIndex: 0, toIndex: 2, trafficLevel: 'heavy', congestionLevel: 4 }],
    }), routeId: 'd2' };
    if (mode === 'walk') other.legs = [{
      type: 'WALK', from: 'A', to: 'B', distanceM: 2000, minutesEst: 25,
      polyline: DRIVE_POLYLINE, a11yFacilities: [],
    }];
    const selected = { ...other, routeId: 'd1' };
    const transit = routePlanFixture().routes[0];
    const result = buildAlternativeRouteLines([selected, other, transit], selected.routeId, mode);
    expect(result.features).toEqual([expect.objectContaining({
      id: 'd2:leg-0', properties: { routeId: 'd2' },
      geometry: { type: 'LineString', coordinates: DRIVE_POLYLINE },
    })]);
  });

  it('does not draw candidates for transit, missing selection or cleared results', () => {
    const routes = [driveRoute(), { ...driveRoute(), routeId: 'd2' }];
    expect(buildAlternativeRouteLines(routes, 'd1', 'transit').features).toEqual([]);
    expect(buildAlternativeRouteLines(routes, null, 'drive').features).toEqual([]);
    expect(buildAlternativeRouteLines(null, 'd1', 'drive').features).toEqual([]);
    expect(buildAlternativeRouteLines([driveRoute()], 'd1', 'drive').features).toEqual([]);
  });
});

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
    expect(data.lines.features.map((f) => f.properties.kind)).toEqual(['walk', 'drive']);
  });
});

describe('walking route classification', () => {
  const polyline: LngLatTuple[] = [[121, 25], [121.001, 25], [121.002, 25], [121.003, 25]];
  function build(overrides: Partial<WalkLeg> = {}) {
    const walk: WalkLeg = { type: 'WALK', from: 'A', to: 'B', distanceM: 300, minutesEst: 5, a11yFacilities: [], polyline, ...overrides };
    return buildRouteLayerData({ ...driveRoute(), legs: [walk] });
  }

  it.each([undefined, []])('keeps unconfirmed walking blue with ranges %j', (sidewalkSegments) => {
    const data = build({ sidewalkSegments });
    expect(data.lines.features).toHaveLength(1);
    expect(data.lines.features[0]).toMatchObject({
      geometry: { coordinates: polyline }, properties: { kind: 'walk', color: WALK_ROUTE.line, casing: WALK_ROUTE.casing },
    });
  });

  it('colors only the confirmed original range green, sharing endpoints with blue runs', () => {
    const data = build({ sidewalkSegments: [{ startIndex: 1, endIndex: 2 }] });
    expect(data.lines.features.map((f) => f.geometry.coordinates)).toEqual([polyline.slice(0, 2), polyline.slice(1, 3), polyline.slice(2)]);
    expect(data.lines.features.map((f) => [f.properties.kind, f.properties.color, f.properties.casing])).toEqual([
      ['walk', WALK_ROUTE.line, WALK_ROUTE.casing], ['sidewalk', WALK_ROUTE.sidewalk, WALK_ROUTE.sidewalkCasing], ['walk', WALK_ROUTE.line, WALK_ROUTE.casing],
    ]);
  });

  it('merges overlapping and adjacent ranges without duplicating geometry or route length', () => {
    const data = build({ sidewalkSegments: [{ startIndex: 1, endIndex: 3 }, { startIndex: 0, endIndex: 1 }, { startIndex: 0, endIndex: 2 }] });
    expect(data.lines.features).toHaveLength(1);
    expect(data.lines.features[0]).toMatchObject({ geometry: { coordinates: polyline }, properties: { kind: 'sidewalk' } });
  });

  it('ignores invalid ranges and never shifts a green range after an invalid coordinate', () => {
    const data = build({ sidewalkSegments: [
      { startIndex: -1, endIndex: 1 }, { startIndex: 1, endIndex: 4 }, { startIndex: 2, endIndex: 1 },
      { startIndex: 1.5, endIndex: 2 }, { startIndex: 1, endIndex: 1 },
    ] });
    expect(data.lines.features.map((f) => f.properties.kind)).toEqual(['walk']);
    const broken = build({ polyline: [[NaN, 25], ...polyline.slice(1)], sidewalkSegments: [{ startIndex: 2, endIndex: 3 }] });
    expect(broken.lines.features.find((f) => f.properties.kind === 'sidewalk')?.geometry.coordinates).toEqual(polyline.slice(2));
    expect(build({ polyline: [[NaN, 25], ...polyline.slice(1)], sidewalkSegments: [{ startIndex: 0, endIndex: 2 }] })
      .lines.features.some((f) => f.properties.kind === 'sidewalk')).toBe(false);
  });

  it('reveals green with the same progress as the rest of the path', () => {
    const data = build({ sidewalkSegments: [{ startIndex: 1, endIndex: 2 }] });
    const halfway = createRouteReveal(data.lines)(0.5);
    expect(halfway.features.map((f) => f.properties.kind)).toEqual(['walk', 'sidewalk']);
    expect(halfway.features[1].geometry.coordinates[0]).toEqual(polyline[1]);
    expect(halfway.features[1].geometry.coordinates.at(-1)?.[0]).toBeCloseTo(121.0015, 6);
  });

  it('retains elevator points without facility line colors overriding blue and green', () => {
    const detail = { indoor: false, distanceM: null, maxSlopePercent: null, minWidthCm: null };
    const data = build({ sidewalkSegments: [{ startIndex: 1, endIndex: 3 }], a11ySegments: [
      { ...detail, feature: 'stairs', startIndex: 0, endIndex: 1 }, { ...detail, feature: 'elevator', startIndex: 2, endIndex: 2 },
    ] });
    expect(data.lines.features.map((f) => f.properties.kind)).toEqual(['walk', 'sidewalk']);
    expect(data.points.features.find((f) => f.properties.kind === 'a11yDot')?.geometry.coordinates).toEqual(polyline[2]);
  });
});

describe('metro line casing', () => {
  const walkLeg: WalkLeg = {
    type: 'WALK', from: 'A', to: 'B', distanceM: 100, minutesEst: 2,
    polyline: [[121.49, 25.02], [121.5, 25.03]], a11yFacilities: [],
  };
  const metroLeg = (lineKey?: string): MetroLeg => ({
    type: 'METRO', railSystem: 'NTMC', lineId: 'Y', ...(lineKey ? { lineKey } : {}), lineName: '環狀線', lineUid: 'NTMC_Y_1',
    departureStation: 'A', arrivalStation: 'B', departureStationUid: 'a', arrivalStationUid: 'b', direction: 0, stopsCount: 3,
    rideMinutes: 6, waitInfo: { time: null, source: 'unavailable' }, estimatedWaitMinutes: 0,
    polyline: [[121.5, 25.03], [121.51, 25.04]], departureStationA11y: [], arrivalStationA11y: [], facilityHighlights: [],
  });
  const build = (leg: MetroLeg) => buildRouteLayerData({ ...driveRoute(), legs: [walkLeg, leg] });

  it('gives a light metro line a same-hue map casing while keeping its transfer point ink', () => {
    const data = build(metroLeg('NTMC_Y'));
    expect(data.lines.features.find((f) => f.properties.id === 'leg-1')?.properties).toMatchObject({ color: '#FFDB00', casing: '#736300' });
    expect(data.points.features.find((f) => f.properties.kind === 'transfer')?.properties).toMatchObject({ color: '#FFDB00', casing: '#1A1A1A' });
  });

  it('outlines an unknown metro line in its mode color without changing its transfer point', () => {
    const data = build(metroLeg());
    expect(data.lines.features.find((f) => f.properties.id === 'leg-1')?.properties).toMatchObject({ color: MODE.metro.line, casing: routeCasingColor(MODE.metro.line) });
    expect(data.points.features.find((f) => f.properties.kind === 'transfer')?.properties).not.toHaveProperty('casing');
  });
});

describe('unified transit and vehicle lines', () => {
  type VehicleType = Exclude<RouteLeg['type'], 'WALK'>;
  const expectedFill: Record<VehicleType, string> = {
    BUS: MODE.bus.line, METRO: MODE.metro.line, TRA: MODE.tra.line, THSR: MODE.hsr.line, DRIVE: MODE.car.line, MOTORCYCLE: MODE.scooter.line,
  };

  it.each<VehicleType>(['BUS', 'METRO', 'TRA', 'THSR', 'DRIVE', 'MOTORCYCLE'])('%s preserves its own color and gets a same-hue casing', (type) => {
    const [route] = adaptRoutePreviewRoutes([{ routeName: 'test', totalMinutes: 10, legs: [{ type, polyline: DRIVE_POLYLINE }] }]);
    const data = buildRouteLayerData(route);
    const color = expectedFill[type];
    expect(data.lines.features[0].properties).toMatchObject({ color, casing: routeCasingColor(color), order: 0 });
  });

  it.each<DriveLeg['type']>(['DRIVE', 'MOTORCYCLE'])('%s preserves each traffic color with its own casing', (type) => {
    const data = buildRouteLayerData(driveRoute({ type, trafficSegments: [{ fromIndex: 1, toIndex: 3, trafficLevel: 'heavy', congestionLevel: 4 }] }));
    expect(data.lines.features.find((f) => f.properties.kind === 'traffic')?.properties).toMatchObject({
      color: TRAFFIC_LEVEL_COLORS.heavy, casing: routeCasingColor(TRAFFIC_LEVEL_COLORS.heavy), order: 1,
    });
  });

  it('does not turn a bus transfer point into a filled marker when adding the bus line casing', () => {
    const [route] = adaptRoutePreviewRoutes([{ routeName: 'test', totalMinutes: 10, legs: [
      { type: 'WALK', polyline: DRIVE_POLYLINE.slice(0, 2) }, { type: 'BUS', polyline: DRIVE_POLYLINE.slice(1) },
    ] }]);
    const data = buildRouteLayerData(route);
    expect(data.lines.features.find((f) => f.properties.id === 'leg-1')?.properties.casing).toBeDefined();
    expect(data.points.features.find((f) => f.properties.kind === 'transfer')?.properties).not.toHaveProperty('casing');
  });
});
