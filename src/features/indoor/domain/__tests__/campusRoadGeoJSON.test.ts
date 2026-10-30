import type { LngLat, LngLatZ, VenueConnection, VenueDetail, VenueWalkway } from '../../types/venue';
import { campusRoadGeoJSON } from '../campusRoadGeoJSON';
import { createVenueDetail } from '../fixtures/venueFixture';

const ORIGIN: LngLat = [121, 25];
const METERS_PER_DEGREE = 6_371_000 * Math.PI / 180;
const LNG_SCALE = METERS_PER_DEGREE * Math.cos(ORIGIN[1] * Math.PI / 180);
const point = (x: number, y: number, z = 0): LngLatZ => [ORIGIN[0] + x / LNG_SCALE, ORIGIN[1] + y / METERS_PER_DEGREE, z];
const ring = (left: number, bottom: number, right: number, top: number): LngLat[] => [
  [left, bottom], [right, bottom], [right, top], [left, top], [left, bottom],
].map(([x, y]) => point(x, y).slice(0, 2) as LngLat);

function venue(): VenueDetail {
  const detail = createVenueDetail();
  detail.center = ORIGIN;
  detail.buildings[0].footprint = [ring(0, 0, 10, 10)];
  detail.buildings[0].levels = detail.buildings[0].levels.map((level, index) => ({ ...level, ordinal: index }));
  detail.walkways = [];
  detail.connections = [];
  return detail;
}

function walkway(id: string, coordinates: [LngLatZ, LngLatZ], extra: Partial<VenueWalkway> = {}): VenueWalkway {
  return {
    id, coordinates, kind: 'footway', indoor: false, nodeIds: [`${id}:a`, `${id}:b`],
    buildingId: null, levelRef: null, buildingIds: [null, null], levelRefs: [null, null],
    geometryStatus: 'schematic', heightStatus: 'estimated', wheelchair: 'unknown', osmRef: id,
    ...extra,
  };
}

function connection(id: string, coordinates: LngLatZ[], extra: Partial<VenueConnection> = {}): VenueConnection {
  return {
    id, coordinates, kind: 'ramp', buildingId: null, levelRefs: coordinates.map(() => null),
    geometryStatus: 'schematic', heightStatus: 'estimated', wheelchair: 'unknown', osmRef: id,
    ...extra,
  };
}

function localSegments(detail: VenueDetail) {
  return campusRoadGeoJSON(detail).features.map((feature) => feature.geometry.coordinates.map(([lng, lat]) => [
    (lng - ORIGIN[0]) * LNG_SCALE, (lat - ORIGIN[1]) * METERS_PER_DEGREE,
  ]));
}

function expectSegments(detail: VenueDetail, expected: number[][][]) {
  const actual = localSegments(detail);
  expect(actual).toHaveLength(expected.length);
  expected.forEach((segment, index) => segment.forEach((point, end) => point.forEach((value, axis) => {
    expect(actual[index][end][axis]).toBeCloseTo(value, 6);
  })));
}

describe('校園底圖道路與 web 相同的來源及裁切語意', () => {
  it('只裁掉建物內段，保留原始戶外端點與來源資料', () => {
    const detail = venue();
    detail.walkways = [walkway('crossing', [point(-5, 5), point(15, 5)])];
    const original = JSON.stringify(detail);

    expectSegments(detail, [[[-5, 5], [0, 5]], [[10, 5], [15, 5]]]);
    expect(campusRoadGeoJSON(detail).features[0].geometry.coordinates[0]).toEqual(detail.walkways[0].coordinates[0].slice(0, 2));
    expect(JSON.stringify(detail)).toBe(original);
  });

  it('庭院洞仍可顯示既有道路，不把洞當作室內', () => {
    const detail = venue();
    detail.buildings[0].footprint.push(ring(3, 3, 7, 7));
    detail.walkways = [walkway('courtyard', [point(-5, 5), point(15, 5)])];

    expectSegments(detail, [[[-5, 5], [0, 5]], [[3, 5], [7, 5]], [[10, 5], [15, 5]]]);
  });

  it('裁切所有建物，保留兩棟之間的既有路段', () => {
    const detail = venue();
    detail.buildings.push({ ...detail.buildings[0], id: 'b', footprint: [ring(20, 0, 30, 10)] });
    detail.walkways = [walkway('between', [point(5, 5), point(25, 5)])];

    expectSegments(detail, [[[10, 5], [20, 5]]]);
  });

  it('不因高度為零就將上層或 indoor 路段當成戶外道路', () => {
    const detail = venue();
    detail.walkways = [
      walkway('upper', [point(15, 5), point(20, 5)], { buildingIds: ['a', 'a'], levelRefs: ['2F', '2F'] }),
      walkway('indoor', [point(15, 5), point(20, 5)], { indoor: true }),
      walkway('unknown-building', [point(15, 5), point(20, 5)], { buildingIds: ['missing', 'missing'], levelRefs: ['1F', '1F'] }),
      walkway('unknown-height', [point(15, 5, 9), point(20, 5, 9)]),
    ];

    expect(campusRoadGeoJSON(detail).features).toEqual([]);
  });

  it('依來源 ordinal 0 及場域地面高度判斷，不靠 1F 字串猜測', () => {
    const detail = venue();
    detail.buildings[0].levels[0] = { ...detail.buildings[0].levels[0], ref: 'G', elevationM: 2.5 };
    detail.walkways = [
      walkway('ground-ref', [point(15, 5, 2.5), point(20, 5, 2.5)], { buildingIds: ['a', 'a'], levelRefs: ['G', 'G'] }),
      walkway('outdoor-ground-height', [point(15, 6, 2.51), point(20, 6, 2.51)]),
      walkway('not-ground-height', [point(15, 7, 2.53), point(20, 7, 2.53)]),
    ];

    expect(campusRoadGeoJSON(detail).features.map((feature) => feature.properties.id)).toEqual([
      'test-venue:3:ground-ref:1:0', 'test-venue:3:outdoor-ground-height:1:0',
    ]);
  });

  it('坡道與階梯需要相連 nodeIds 的戶外證據，保留每個原始相鄰段', () => {
    const detail = venue();
    detail.walkways = [walkway('approach', [point(15, 5), point(20, 5)], { nodeIds: ['entry', 'outside'] })];
    detail.connections = [
      connection('ramp', [point(5, 5), point(15, 5)], { nodeIds: ['inside', 'entry'] }),
      connection('steps', [point(20, 5), point(22, 5), point(24, 5)], { kind: 'steps', nodeIds: ['outside', 'mid', 'end'] }),
      connection('unowned', [point(15, 6), point(20, 6)]),
      connection('upper-stairs', [point(15, 5), point(15, 5, 3)], { kind: 'stairs', nodeIds: ['entry', 'upper'], buildingId: 'a', levelRefs: ['1F', '2F'] }),
      connection('lift', [point(15, 5), point(15, 5, 3)], { kind: 'elevator', nodeIds: ['entry', 'upper'], levelRefs: ['1F', '2F'] }),
    ];

    const result = campusRoadGeoJSON(detail);
    expect(result.features.map((feature) => feature.properties.id)).toEqual([
      'test-venue:3:approach:1:0', 'test-venue:3:ramp:1:0', 'test-venue:3:steps:1:0', 'test-venue:3:steps:2:0',
    ]);
    expect(result.features.slice(2).map((feature) => feature.properties.subclass)).toEqual(['steps', 'steps']);
    expectSegments(detail, [[[15, 5], [20, 5]], [[10, 5], [15, 5]], [[20, 5], [22, 5]], [[22, 5], [24, 5]]]);
  });

  it('共享節點後續出現室內紀錄，仍保留已發布的戶外證據', () => {
    const detail = venue();
    detail.walkways = [
      walkway('outdoor', [point(15, 5), point(20, 5)], { nodeIds: ['shared', 'outside'] }),
      walkway('indoor', [point(5, 5), point(15, 5)], { indoor: true, nodeIds: ['inside', 'shared'], buildingIds: ['a', 'a'], levelRefs: ['1F', '1F'] }),
    ];
    detail.connections = [connection('ramp', [point(15, 5), point(25, 5)], { nodeIds: ['shared', 'other'] })];

    expect(campusRoadGeoJSON(detail).features.some((feature) => feature.properties.id.includes(':ramp:'))).toBe(true);
  });

  it('來源 ID 去重並維持 service 的底圖分類', () => {
    const detail = venue();
    const road = walkway('service', [point(15, 5), point(20, 5)], { kind: 'service' });
    detail.walkways = [road, { ...road }];
    detail.connections = [connection('service', road.coordinates, { nodeIds: road.nodeIds })];

    const result = campusRoadGeoJSON(detail);
    expect(result.features).toHaveLength(1);
    expect(result.features[0].properties).toEqual({ id: 'test-venue:3:service:1:0', roadClass: 'service', class: 'service', subclass: 'pedestrian', layer: 0 });
  });

  it('空資料與退化路段不產生虛構線段', () => {
    const detail = venue();
    expect(campusRoadGeoJSON(detail).features).toEqual([]);
    detail.walkways = [walkway('same-point', [point(15, 5), point(15, 5)])];
    detail.connections = [connection('empty', []), connection('single', [point(15, 5)])];
    expect(campusRoadGeoJSON(detail).features).toEqual([]);
  });
});
