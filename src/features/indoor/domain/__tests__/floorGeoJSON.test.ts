import { buildingBounds, floorGeoJSON, routeFloorGeoJSON, venueCacheKey } from '../floorGeoJSON';
import { createVenueDetail, createVenueRoute } from '../fixtures/venueFixture';
import type { VenueRoute } from '../../types/venue';

describe('原生樓層圖幾何', () => {
  it('保留 polygon 洞與地理座標，樓層只包含該層地點', () => {
    const detail = createVenueDetail();
    const floor = floorGeoJSON(detail, 'a', '1F');
    expect(floor.features.find((feature) => feature.properties.layer === 'area')?.geometry).toEqual(detail.features[0].geometry);
    expect(floor.features.filter((feature) => feature.properties.layer === 'place').map((feature) => feature.properties.placeId)).toEqual(['start']);
    expect(floor.features.find((feature) => feature.properties.layer === 'walkway')?.geometry).toEqual({ type: 'LineString', coordinates: [[121, 25], [121.0001, 25]] });
  });
  it('電梯井道出現的樓層不憑空新增停靠點', () => {
    const floor = floorGeoJSON(createVenueDetail(), 'a', '3F');
    expect(floor.features.some((feature) => feature.properties.kind === 'elevator')).toBe(true);
    expect(floor.features.filter((feature) => feature.properties.layer === 'connection')).toEqual([]);
  });
  it('跨層路線不會被壓到單一樓層，也不連接不連續的同層片段', () => {
    const route = createVenueRoute();
    const floor = routeFloorGeoJSON(route, createVenueDetail(), 'a', '1F');
    expect(floor.features.filter((feature) => feature.geometry.type === 'LineString')).toEqual([{ type: 'Feature', id: 'route-edge:0', geometry: { type: 'LineString', coordinates: [[121, 25], [121.0001, 25]] }, properties: { kind: 'route', pathStart: 0, pathEnd: 1 } }]);
    route.path.levelRefs = ['1F', '2F', '1F', '2F'];
    expect(routeFloorGeoJSON(route, createVenueDetail(), 'a', '1F').features.filter((feature) => feature.geometry.type === 'LineString')).toEqual([]);
  });
  it('不以未知建物推導bounds；版本鍵包含場館和版本', () => {
    expect(buildingBounds(createVenueDetail(), 'unknown')).toBeNull();
    expect(buildingBounds(createVenueDetail(), 'a')).toEqual([121, 25, 121.001, 25.001]);
    expect(venueCacheKey('test-venue', 3)).toBe('test-venue:3');
  });
});

function campusJourney() {
  const detail = createVenueDetail();
  detail.buildings[0].levels[0].ordinal = 0;
  detail.buildings.push({ ...detail.buildings[0], id: 'b', levels: detail.buildings[0].levels.map((level) => ({ ...level })) });
  const route: VenueRoute = { ...createVenueRoute(), path: {
    coordinates: Array.from({ length: 6 }, (_, index) => [121 + index * 0.0001, 25, 0]),
    buildingIds: ['a', 'a', null, null, 'b', 'b'], levelRefs: ['1F', '1F', null, null, '1F', '1F'],
  } };
  return { detail, route };
}

describe('同樓層跨棟與校園路線', () => {
  it('連續保留一樓出入口、戶外步道與另一棟一樓的每條來源邊，亦支援反向', () => {
    const { detail, route } = campusJourney();
    const before = JSON.stringify({ detail, route });
    const lines = routeFloorGeoJSON(route, detail, 'a', '1F').features.filter((feature) => feature.geometry.type === 'LineString');
    expect(lines.map((feature) => [feature.properties.pathStart, feature.properties.pathEnd])).toEqual([[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]]);
    expect(lines.map((feature) => feature.geometry.coordinates)).toEqual(route.path.coordinates.slice(1).map((point, index) => [route.path.coordinates[index].slice(0, 2), point.slice(0, 2)]));
    expect(JSON.stringify({ detail, route })).toBe(before);
    route.path.coordinates.reverse(); route.path.buildingIds.reverse(); route.path.levelRefs.reverse();
    const reverse = routeFloorGeoJSON(route, detail, 'b', '1F').features.filter((feature) => feature.geometry.type === 'LineString');
    expect(reverse.map((feature) => feature.geometry.coordinates)).toEqual([...lines].reverse().map((feature) => [...feature.geometry.coordinates].reverse()));
  });

  it('只以來源 ordinal 0 接納戶外點，不能用 1F 名稱或零高度猜測地面層', () => {
    const { detail, route } = campusJourney();
    detail.buildings.forEach((building) => { building.levels[0].ordinal = 1; });
    expect(routeFloorGeoJSON(route, detail, 'a', '1F').features.filter((feature) => feature.geometry.type === 'LineString').map((feature) => feature.properties.pathStart)).toEqual([0, 4]);
    expect(routeFloorGeoJSON(route, detail, 'a', '2F').features).toEqual([]);
  });

  it('戶外點只容許 venue datum 或該地面層高度的 0.02m 範圍，排除樓梯中間點', () => {
    const { detail, route } = campusJourney();
    detail.buildings.forEach((building) => { building.levels[0].elevationM = 2; });
    route.path.coordinates.forEach((point) => { point[2] = 2; });
    route.path.coordinates[2][2] = 0.019;
    route.path.coordinates[3][2] = 2.019;
    const starts = () => routeFloorGeoJSON(route, detail, 'a', '1F').features.filter((feature) => feature.geometry.type === 'LineString').map((feature) => feature.properties.pathStart);
    expect(starts()).toEqual([0, 1, 2, 3, 4]);
    route.path.coordinates[3][2] = 2.021;
    expect(starts()).toEqual([0, 1, 4]);
    route.path.coordinates[3][2] = 2;
    route.path.buildingIds[3] = 'a';
    expect(starts()).toEqual([0, 1, 4]);
  });

  it('不把隱藏樓層或缺少樓層的建物當成捷徑，也不重新連接剩餘點', () => {
    const { detail, route } = campusJourney();
    route.path.levelRefs[4] = '2F';
    expect(routeFloorGeoJSON(route, detail, 'a', '1F').features.filter((feature) => feature.geometry.type === 'LineString').map((feature) => feature.properties.pathStart)).toEqual([0, 1, 2]);
    route.path.levelRefs[4] = '1F';
    detail.buildings[1].levels = detail.buildings[1].levels.filter((level) => level.ref !== '1F');
    expect(routeFloorGeoJSON(route, detail, 'a', '1F').features.filter((feature) => feature.geometry.type === 'LineString').map((feature) => feature.properties.pathStart)).toEqual([0, 1, 2]);
  });

  it('樓層存在但無平面資料時不捏造室內線，只保留有來源的入口邊', () => {
    const { detail, route } = campusJourney();
    detail.buildings[1].levels[0] = { ...detail.buildings[1].levels[0], coverage: { hasAnchor: true, hasRouteData: true, hasDisplayGeometry: false } };
    expect(routeFloorGeoJSON(route, detail, 'a', '1F').features.filter((feature) => feature.geometry.type === 'LineString').map((feature) => feature.properties.pathStart)).toEqual([0, 1, 2, 3]);
  });

  it('沒有任何可顯示的地面層時，不用只有樓層名稱的資料放行戶外路線', () => {
    const { detail, route } = campusJourney();
    detail.buildings.forEach((building) => {
      building.levels[0] = { ...building.levels[0], coverage: { hasAnchor: true, hasRouteData: true, hasDisplayGeometry: false } };
    });
    expect(routeFloorGeoJSON(route, detail, 'a', '1F').features).toEqual([]);
  });

  it('同棟邊依 web 展示層高裁切，保留來源索引而不顯示上層路徑', () => {
    const { detail, route } = campusJourney();
    route.path.coordinates[0][2] = 3;
    route.path.coordinates[1][2] = 3;
    expect(routeFloorGeoJSON(route, detail, 'a', '1F').features.filter((feature) => feature.geometry.type === 'LineString').map((feature) => feature.properties.pathStart)).toEqual([1, 2, 3, 4]);
    route.path.coordinates[0][2] = 0;
    const first = routeFloorGeoJSON(route, detail, 'a', '1F').features[0];
    if (first.geometry.type !== 'LineString') throw new Error('Expected clipped source edge');
    expect(first.properties).toEqual({ kind: 'route', pathStart: 0, pathEnd: 1 });
    expect(first.geometry.coordinates[0]).toEqual([121, 25]);
    expect(first.geometry.coordinates[1][0]).toBeCloseTo(121 + 0.0001 * 0.85 / 3, 10);
    expect(route.path.coordinates[1][2]).toBe(3);
  });

  it('來源 context 長度不符時不繪製錯位路線', () => {
    const { detail, route } = campusJourney();
    route.path.levelRefs.pop();
    expect(routeFloorGeoJSON(route, detail, 'a', '1F').features).toEqual([]);
  });
});
