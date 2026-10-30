import { getIndoorPalette } from '@/shared/theme/indoorPalette';
import type { LngLat, VenueDetail, VenueFeature } from '../../types/venue';
import { campusSceneGeoJSON, indoorSceneGeoJSON, INDOOR_DISPLAY } from '../indoorSceneGeoJSON';
import { createVenueDetail } from '../fixtures/venueFixture';

const origin: LngLat = [121, 25];
const meters = 6_371_000 * Math.PI / 180;
const lngMeters = meters * Math.cos(origin[1] * Math.PI / 180);
const geo = (x: number, y: number): LngLat => [origin[0] + x / lngMeters, origin[1] + y / meters];
const box = (x: number, y: number, width: number, height: number): LngLat[] => [geo(x, y), geo(x + width, y), geo(x + width, y + height), geo(x, y + height), geo(x, y)];
function polygon(id: string, kind: VenueFeature['kind'], rings: LngLat[][], tags?: VenueFeature['tags']): VenueFeature {
  return { id, kind, buildingId: 'a', levelRef: '2F', ordinal: 2, geometry: { type: 'Polygon', coordinates: rings }, geometryStatus: 'traced', heightStatus: 'estimated', tags };
}
function fixture(features: VenueFeature[]): VenueDetail {
  const detail = createVenueDetail();
  detail.features = features;
  detail.walls = [];
  detail.connections = [];
  detail.walkways = [];
  detail.places = [];
  detail.buildings[0].footprint = [box(0, 0, 20, 20)];
  detail.buildings[0].levels[1].elevationM = 999;
  return detail;
}
function polygonArea(coordinates: number[][][]): number {
  return coordinates.reduce((sum, ring, index) => {
    const local = ring.map(([lng, lat]) => [(lng - origin[0]) * lngMeters, (lat - origin[1]) * meters]);
    const area = Math.abs(local.reduce((sum, point, i) => { const next = local[(i + 1) % local.length]; return sum + point[0] * next[1] - next[0] * point[1]; }, 0)) / 2;
    return sum + (index === 0 ? area : -area);
  }, 0);
}

function containsPoint(point: LngLat, coordinates: number[][][]): boolean {
  const within = (ring: number[][]) => {
    let result = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
    }
    return result;
  };
  return within(coordinates[0]) && !coordinates.slice(1).some(within);
}

describe('室內 grounded cutaway', () => {
  it('樓板與房間保留來源洞，選中樓層高度不隨999m來源高程抬升', () => {
    const rings = [box(0, 0, 10, 10), box(3, 3, 2, 2)];
    const scene = indoorSceneGeoJSON(fixture([polygon('room', 'room', rings)]), 'a', '2F');
    const surfaces = scene.features.filter((item) => item.properties.kind === 'surface');
    expect(surfaces[0].geometry.coordinates).toEqual(rings);
    const slab = scene.features.filter((item) => item.properties.kind === 'slab');
    expect(slab).toHaveLength(1);
    expect(slab[0].geometry.coordinates).toHaveLength(2);
    expect(polygonArea(slab[0].geometry.coordinates)).toBeCloseTo(96, 5);
    expect(slab[0].properties).toMatchObject({ base: 0, height: 0.16, sourceElevationM: 999, displayOnly: true });
    expect(scene.features.filter((item) => item.properties.kind === 'wall').every((item) => item.properties.base === 0.16 && item.properties.height === 1.01)).toBe(true);
    expect(INDOOR_DISPLAY.wallThickness).toBe(0.12);
  });
  it('重疊樓板片會合併，明確void從樓板扣除，未知area不新增牆', () => {
    const detail = fixture([
      polygon('base', 'area', [box(0, 0, 10, 10)], { 'a11ymap:area_type': 'indoor-floor-base' }),
      polygon('corridor', 'corridor', [box(8, 0, 4, 10)]),
      polygon('void', 'area', [box(4, 4, 2, 2)], { 'a11ymap:area_type': 'void' }),
      polygon('unknown', 'area', [box(15, 0, 2, 2)]),
    ]);
    const scene = indoorSceneGeoJSON(detail, 'a', '2F');
    const slabs = scene.features.filter((item) => item.properties.kind === 'slab');
    expect(slabs.reduce((sum, item) => sum + polygonArea(item.geometry.coordinates), 0)).toBeCloseTo(116, 5);
    expect(scene.features.filter((item) => item.properties.sourceId === 'unknown').every((item) => item.properties.kind !== 'wall')).toBe(true);
    expect(scene.features.some((item) => item.properties.kind === 'surface' && item.properties.sourceId === 'void')).toBe(false);
  });
  it('廁所、走道、房間、電梯、樓梯及混合核心各有來源材質', () => {
    const detail = fixture([
      polygon('room', 'room', [box(0, 0, 2, 2)]),
      polygon('toilet', 'area', [box(3, 0, 2, 2)], { amenity: 'toilets' }),
      polygon('corridor', 'corridor', [box(0, 3, 5, 2)]),
      polygon('lift', 'elevator', [box(6, 0, 2, 2)], { 'a11ymap:area_type': 'elevator-shaft' }),
      polygon('stairs', 'stairs', [box(6, 3, 2, 2)], { 'a11ymap:area_type': 'stairwell' }),
      polygon('core', 'area', [box(9, 0, 2, 2)], { 'a11ymap:area_type': 'vertical-core' }),
    ]);
    const roles = indoorSceneGeoJSON(detail, 'a', '2F').features.filter((item) => item.properties.kind === 'surface').map((item) => item.properties.role);
    expect(roles).toEqual(expect.arrayContaining(['room', 'toilet', 'corridor', 'elevator', 'stairs', 'core']));
  });
  it('井道未停靠樓層顯示nonStopping，未有connection時保持unknown', () => {
    const lift = polygon('lift-feature', 'elevator', [box(0, 0, 2, 2)]);
    lift.connectionId = 'lift';
    const detail = fixture([lift]);
    const connection = createVenueDetail().connections[0];
    detail.connections = [{ ...connection, levelRefs: ['1F', '3F'] }];
    let surface = indoorSceneGeoJSON(detail, 'a', '2F').features.find((item) => item.properties.kind === 'surface');
    expect(surface?.properties).toMatchObject({ role: 'nonStopping', servesLevel: false });
    detail.connections[0].levelRefs = ['1F', '2F'];
    surface = indoorSceneGeoJSON(detail, 'a', '2F').features.find((item) => item.properties.kind === 'surface');
    expect(surface?.properties).toMatchObject({ role: 'elevator', servesLevel: true });
    detail.connections[0].buildingId = 'other';
    surface = indoorSceneGeoJSON(detail, 'a', '2F').features.find((item) => item.properties.kind === 'surface');
    expect(surface?.properties.servesLevel).toBeNull();
  });
  it('只用同棟同層featureId或唯一ref對應地點，不用名稱／距離猜測', () => {
    const room = { ...polygon('room', 'room', [box(0, 0, 2, 2)]), ref: '201' };
    const detail = fixture([room]);
    const place = { ...createVenueDetail().places[1], id: 'place', featureId: 'room', ref: '201' };
    detail.places = [place, { ...place, id: 'other-floor', levelRef: '1F' }, { ...place, id: 'other-building', buildingId: 'b' }];
    expect(indoorSceneGeoJSON(detail, 'a', '2F').features.find((item) => item.properties.kind === 'surface')?.properties.placeId).toBe('place');
    detail.places = [{ ...place, featureId: undefined }];
    expect(indoorSceneGeoJSON(detail, 'a', '2F').features.find((item) => item.properties.kind === 'surface')?.properties.placeId).toBe('place');
    detail.places.push({ ...place, featureId: undefined, id: 'ambiguous' });
    expect(indoorSceneGeoJSON(detail, 'a', '2F').features.find((item) => item.properties.kind === 'surface')?.properties.placeId).toBeNull();
  });
  it('其他建物只有低地基context，不混入其房間或牆', () => {
    const detail = fixture([polygon('a-room', 'room', [box(0, 0, 2, 2)]), { ...polygon('b-room', 'room', [box(30, 0, 2, 2)]), buildingId: 'b' }]);
    detail.buildings.push({ ...detail.buildings[0], id: 'b', footprint: [box(30, 0, 5, 5)] });
    const other = indoorSceneGeoJSON(detail, 'a', '2F').features.filter((item) => item.properties.buildingId === 'b');
    expect(other).toHaveLength(1);
    expect(other[0].properties).toMatchObject({ active: false, kind: 'context', height: 0.035, levelRef: null });
  });
  it('校區場景同時顯示各棟同名樓層，保持原始樓層高程與房間身分', () => {
    const detail = fixture([polygon('a-room', 'room', [box(0, 0, 2, 2)]), { ...polygon('b-room', 'room', [box(30, 0, 2, 2)]), buildingId: 'b' }]);
    detail.buildings.push({ ...detail.buildings[0], id: 'b', footprint: [box(30, 0, 5, 5)],
      levels: detail.buildings[0].levels.map((level) => ({ ...level, elevationM: level.elevationM + 2 })) });
    const snapshot = JSON.stringify(detail);
    const scene = campusSceneGeoJSON(detail, 'a', '2F');
    const rooms = scene.features.filter((feature) => feature.properties.kind === 'surface');
    expect(rooms.map((feature) => feature.properties.sourceId)).toEqual(['a-room', 'b-room']);
    expect(rooms.map((feature) => feature.properties.sourceElevationM)).toEqual([999, 1001]);
    expect(scene.features.some((feature) => feature.properties.kind === 'context')).toBe(false);
    expect(JSON.stringify(detail)).toBe(snapshot);
  });
  it('旁棟缺同名樓層或沒有該層圖資時只保留輪廓，不補畫其他樓層', () => {
    const detail = fixture([polygon('a-room', 'room', [box(0, 0, 2, 2)]), { ...polygon('b-room', 'room', [box(30, 0, 2, 2)]), buildingId: 'b' }]);
    detail.buildings.push({ ...detail.buildings[0], id: 'b', footprint: [box(30, 0, 5, 5)], levels: detail.buildings[0].levels.filter((level) => level.ref !== '2F') });
    const missing = campusSceneGeoJSON(detail, 'a', '2F').features.filter((feature) => feature.properties.buildingId === 'b');
    expect(missing).toHaveLength(1);
    expect(missing[0].properties.kind).toBe('context');
    detail.buildings[1].levels = detail.buildings[0].levels.map((level) => ({ ...level, coverage: { ...level.coverage, hasDisplayGeometry: false } }));
    expect(campusSceneGeoJSON(detail, 'a', '2F').features.filter((feature) => feature.properties.buildingId === 'b')).toEqual(missing);
  });
  it('明確牆線buffer保留來源牆厚；未知厚度採顯示值不隱藏', () => {
    const detail = fixture([polygon('room', 'room', [box(0, 0, 10, 10)])]);
    detail.walls = [{ ...createVenueDetail().walls[0], levelRef: '2F', ordinal: 2, thicknessM: 0.2, geometry: { type: 'LineString', coordinates: [geo(2, 2), geo(8, 2)] } }];
    const walls = indoorSceneGeoJSON(detail, 'a', '2F').features.filter((item) => item.properties.sourceId === 'wall');
    expect(walls.length).toBeGreaterThan(0);
    expect(walls.every((item) => item.properties.thicknessKind === 'source' && item.properties.thicknessM === 0.2)).toBe(true);
    expect(walls.reduce((sum, item) => sum + polygonArea(item.geometry.coordinates), 0)).toBeCloseTo(1.2, 4);
  });
  it('依跨出樓板的來源路網保留展示入口，沒有來源連線就不猜門位', () => {
    const detail = fixture([polygon('corridor', 'corridor', [box(0, 0, 10, 10)])]);
    const passage = createVenueDetail().walkways[0];
    detail.walkways = [{ ...passage, buildingId: null, levelRef: null, buildingIds: ['a', null], levelRefs: ['2F', null], coordinates: [[...geo(5, 1), 3], [...geo(5, -1), 3]] }];
    let walls = indoorSceneGeoJSON(detail, 'a', '2F').features.filter((feature) => feature.properties.kind === 'wall');
    expect(walls.some((wall) => containsPoint(geo(5, 0.05), wall.geometry.coordinates))).toBe(false);
    expect(walls.some((wall) => containsPoint(geo(2, 0.05), wall.geometry.coordinates))).toBe(true);
    detail.walkways = [];
    walls = indoorSceneGeoJSON(detail, 'a', '2F').features.filter((feature) => feature.properties.kind === 'wall');
    expect(walls.some((wall) => containsPoint(geo(5, 0.05), wall.geometry.coordinates))).toBe(true);
  });
  it('電梯井道側牆遵循來源approach，保留整個入口側且不封住走廊', () => {
    const shaft = polygon('shaft', 'elevator', [box(4, 4, 2, 2)], { 'a11ymap:area_type': 'elevator-shaft' });
    shaft.connectionId = 'lift';
    const detail = fixture([polygon('corridor', 'corridor', [box(0, 0, 10, 4)]), shaft]);
    detail.connections = [{ ...createVenueDetail().connections[0], nodeIds: ['stop1', 'stop2'], coordinates: [[...geo(5, 5), 0], [...geo(5, 5), 3]] }];
    detail.walkways = [{ ...createVenueDetail().walkways[0], levelRef: '2F', levelRefs: ['2F', '2F'], nodeIds: ['approach', 'stop2'], coordinates: [[...geo(5, 3), 3], [...geo(5, 5), 3]] }];
    const walls = indoorSceneGeoJSON(detail, 'a', '2F').features.filter((feature) => feature.properties.kind === 'wall');
    expect(walls.some((wall) => containsPoint(geo(5, 4.05), wall.geometry.coordinates))).toBe(false);
    expect(walls.some((wall) => containsPoint(geo(4.05, 5), wall.geometry.coordinates))).toBe(true);
    expect(walls.some((wall) => containsPoint(geo(5, 3.95), wall.geometry.coordinates))).toBe(false);
  });
  it('旋轉共邊與極小交點仍產生閉合樓板及有限牆polygon', () => {
    const angle = 0.43;
    const rotated = (x: number, y: number): LngLat => geo(x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle));
    const rectangle = (x: number, y: number, width: number, height: number): LngLat[] => [rotated(x, y), rotated(x + width, y), rotated(x + width, y + height), rotated(x, y + height), rotated(x, y)];
    const detail = fixture([
      polygon('room-a', 'room', [rectangle(0, 0, 10, 5)]),
      polygon('room-b', 'room', [rectangle(10 + 1e-9, 0, 10, 5)]),
      polygon('corridor', 'corridor', [rectangle(0, 5 - 1e-9, 20, 3)]),
      polygon('coverage', 'area', [rectangle(0, 0, 20, 8)], { 'a11ymap:area_type': 'indoor-floor-base' }),
    ]);
    const scene = indoorSceneGeoJSON(detail, 'a', '2F');
    const slabs = scene.features.filter((feature) => feature.properties.kind === 'slab');
    expect(slabs).toHaveLength(1);
    expect(polygonArea(slabs[0].geometry.coordinates)).toBeCloseTo(160, 5);
    expect(scene.features.some((feature) => feature.properties.kind === 'wall')).toBe(true);
    for (const feature of scene.features) for (const ring of feature.geometry.coordinates) {
      expect(ring.length).toBeGreaterThanOrEqual(4);
      expect(ring[0]).toEqual(ring[ring.length - 1]);
      expect(ring.every((point) => point.every(Number.isFinite))).toBe(true);
    }
  });
  it('日夜色票對齊web室內材質且不以色彩新增可通行語意', () => {
    expect(getIndoorPalette('light').material.wall).toBe('#fafafa');
    expect(getIndoorPalette('dark').material.wall).toBe('#8391a5');
    expect(getIndoorPalette('light').material.elevator).not.toBe(getIndoorPalette('light').material.nonStopping);
  });
});
