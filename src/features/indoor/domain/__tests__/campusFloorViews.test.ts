import { campusFloorViews, defaultIndoorLevel } from '../campusFloorViews';
import { createVenueDetail } from '../fixtures/venueFixture';

it('各棟同步同名樓層；缺樓層不回退 1F，無平面資料不宣稱有圖', () => {
  const detail = createVenueDetail();
  const source = detail.buildings[0];
  detail.buildings.push(
    { ...source, id: 'b', levels: source.levels.filter((level) => level.ref !== '2F') },
    { ...source, id: 'c', levels: source.levels.map((level) => ({ ...level, coverage: { ...level.coverage, hasDisplayGeometry: false } })) },
  );
  expect(campusFloorViews(detail, 'a', '2F')).toEqual([
    { buildingId: 'a', levelRef: '2F', ordinal: 2, elevationM: 3, hasDisplayGeometry: true },
    { buildingId: 'c', levelRef: '2F', ordinal: 2, elevationM: 3, hasDisplayGeometry: false },
  ]);
  expect(campusFloorViews(detail, 'b', '2F')).toEqual([]);
  expect(campusFloorViews(detail, 'unknown', '1F')).toEqual([]);
});

it('初始校園視圖只取各棟來源地面層，容許不同命名與高度', () => {
  const detail = createVenueDetail();
  detail.buildings[0].levels[0].ordinal = 0;
  detail.buildings.push({ ...detail.buildings[0], id: 'b', levels: [{ ...detail.buildings[0].levels[0], ref: 'G', elevationM: 2 }] });
  expect(campusFloorViews(detail, null, null).map((view) => [view.buildingId, view.levelRef, view.ordinal, view.elevationM])).toEqual([['a', '1F', 0, 0], ['b', 'G', 0, 2]]);
  expect(campusFloorViews(detail, null, '1F')).toEqual([]);
});

it('預設優先有平面資料的 1F，其次可顯示層，沒有平面才保留首層來源', () => {
  const levels = createVenueDetail().buildings[0].levels;
  expect(defaultIndoorLevel(levels)?.ref).toBe('1F');
  levels[0].coverage.hasDisplayGeometry = false;
  expect(defaultIndoorLevel(levels)?.ref).toBe('2F');
  levels.forEach((level) => { level.coverage.hasDisplayGeometry = false; });
  expect(defaultIndoorLevel(levels)?.ref).toBe('1F');
  expect(defaultIndoorLevel([])).toBeUndefined();
});
