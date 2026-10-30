import { buildingBounds, floorGeoJSON, routeFloorGeoJSON, venueCacheKey } from '../floorGeoJSON';
import { createVenueDetail, createVenueRoute } from '../fixtures/venueFixture';

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
    const floor = routeFloorGeoJSON(route, 'a', '1F');
    expect(floor.features.filter((feature) => feature.geometry.type === 'LineString')).toEqual([{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[121, 25], [121.0001, 25]] }, properties: { kind: 'route' } }]);
    route.path.levelRefs = ['1F', '2F', '1F', '2F'];
    expect(routeFloorGeoJSON(route, 'a', '1F').features.filter((feature) => feature.geometry.type === 'LineString')).toEqual([]);
  });
  it('不以未知建物推導bounds；版本鍵包含場館和版本', () => {
    expect(buildingBounds(createVenueDetail(), 'unknown')).toBeNull();
    expect(buildingBounds(createVenueDetail(), 'a')).toEqual([121, 25, 121.001, 25.001]);
    expect(venueCacheKey('test-venue', 3)).toBe('test-venue:3');
  });
});
