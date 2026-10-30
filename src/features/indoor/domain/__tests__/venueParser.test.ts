import { parseVenueRoute } from '@/shared/venue';
import { parseVenueDetail, parseVenueSummaries } from '../venueParser';
import { createVenueDetail, createVenueRoute } from '../fixtures/venueFixture';

const invalid = expect.objectContaining({ reason: 'INVALID_BACKEND_DATA' });

describe('場館資料契約邊界', () => {
  it('保留多個 polygon rings、門位未知與資料可信度註記', () => {
    const detail = parseVenueDetail(createVenueDetail());
    expect(detail.features[0].geometry).toEqual(createVenueDetail().features[0].geometry);
    expect(detail.places[0]).toMatchObject({ arrivalKind: 'corridor', doorKnown: false });
    expect(detail.buildings[0]).toMatchObject({ heightPending: true, note: '測試資料', fixme: '高度待確認' });
    expect(detail.buildings[0].levels[2].coverage.hasRouteData).toBe(false);
  });
  it('空場館清單是有效狀態，缺失 data 不是', () => {
    expect(parseVenueSummaries([])).toEqual([]);
    expect(() => parseVenueSummaries(undefined)).toThrow(invalid);
  });
  it('拒絕重複場館／樓層／地點身分', () => {
    const detail = createVenueDetail();
    expect(() => parseVenueDetail({ ...detail, places: [...detail.places, detail.places[0]] })).toThrow(invalid);
    detail.buildings[0].levels.push(detail.buildings[0].levels[0]);
    expect(() => parseVenueDetail(detail)).toThrow(invalid);
  });
  it('拒絕非有限或超出經緯度範圍的座標', () => {
    const detail = createVenueDetail();
    expect(() => parseVenueDetail({ ...detail, center: [NaN, 25] })).toThrow(invalid);
    expect(() => parseVenueDetail({ ...detail, center: [121, 91] })).toThrow(invalid);
  });
  it('拒絕未閉合的 polygon 和不存在的樓層', () => {
    const detail = createVenueDetail();
    detail.buildings[0].footprint[0].pop();
    expect(() => parseVenueDetail(detail)).toThrow(invalid);
    const other = createVenueDetail();
    other.places[0].levelRef = '99F';
    expect(() => parseVenueDetail(other)).toThrow(invalid);
  });
  it('電梯只接受與停靠點同長的樓層與 nodeIds', () => {
    const detail = createVenueDetail();
    detail.connections[0].levelRefs.push('3F');
    expect(() => parseVenueDetail(detail)).toThrow(invalid);
  });
  it('舊資料未提供牆線時正規化為空陣列', () => {
    expect(parseVenueDetail({ ...createVenueDetail(), walls: undefined }).walls).toEqual([]);
  });
});

describe('室內路段解析', () => {
  it('接受跨層路線與包含端點的零長步驟', () => {
    const route = createVenueRoute();
    expect(parseVenueRoute(route, route)).toEqual(route);
  });
  it('拒絕不一致 path context 長度、越界索引與負距離', () => {
    const route = createVenueRoute();
    expect(() => parseVenueRoute({ ...route, path: { ...route.path, levelRefs: ['1F'] } })).toThrow(invalid);
    expect(() => parseVenueRoute({ ...route, steps: [{ ...route.steps[0], pathEnd: 4 }] })).toThrow(invalid);
    expect(() => parseVenueRoute({ ...route, distanceM: -1 })).toThrow(invalid);
  });
  it('拒絕不連續或未覆蓋終點的導引，避免顯示不完整路線', () => {
    const route = createVenueRoute();
    expect(() => parseVenueRoute({ ...route, steps: route.steps.slice(0, 2) })).toThrow(invalid);
    expect(() => parseVenueRoute({ ...route, segments: [route.segments[0], { ...route.segments[1], pathStart: 3 }] })).toThrow(invalid);
    expect(() => parseVenueRoute({ ...route, steps: route.steps.map((step) => step.type === 'elevator' ? { ...step, type: 'stairs' } : step) })).toThrow(invalid);
  });
  it('拒絕回傳不同起訖／模式的路線', () => {
    const route = createVenueRoute();
    expect(() => parseVenueRoute(route, { ...route, mode: 'normal' })).toThrow(invalid);
    expect(() => parseVenueRoute(route, { ...route, toPlaceId: 'another' })).toThrow(invalid);
  });
});
