import { parseFacilities } from '../facilities';
import { NEARBY_LIMIT, buildFilteredNearbyItems, buildNearbyItems, countNearby } from '../nearby';
import { parseParkingItems } from '../parking';

const origin = { lat: 25.05, lng: 121.5 };
/** 往北 meters 公尺（1 度緯度約 111,195 m） */
const north = (meters: number): [number, number] => [121.5, 25.05 + meters / 111195];

const facility = (id: string, category: string, meters: number) => ({
  _id: id,
  name: id,
  location: { type: 'Point', coordinates: north(meters) },
  category,
  source: 'bathroom',
});

describe('buildNearbyItems', () => {
  const facilities = parseFacilities([
    facility('far', 'toilet', 2500),
    facility('t300', 'toilet', 300),
    facility('e100', 'elevator', 100),
  ]);

  it('依距離排序並排除 2 km 以外', () => {
    const items = buildNearbyItems(origin, facilities, [], new Set());
    expect(items.map((item) => item.id)).toEqual(['e100', 't300']);
    expect(items[0]?.distance).toBeCloseTo(100, 0);
  });

  it('有選取類別時只列該類設施', () => {
    expect(buildNearbyItems(origin, facilities, [], new Set(['toilet'])).map((item) => item.id)).toEqual(['t300']);
  });

  it('最多 10 筆', () => {
    const many = parseFacilities(Array.from({ length: 15 }, (_, i) => facility(`f${i}`, 'ramp', i * 10)));
    expect(buildNearbyItems(origin, many, [], new Set())).toHaveLength(NEARBY_LIMIT);
  });

  it('停車與設施合併排序', () => {
    const parking = parseParkingItems([
      {
        type: 'lot',
        _id: 'p50',
        carParkId: 'c1',
        name: '停車場',
        city: '臺北市',
        location: { type: 'Point', coordinates: north(50) },
        importedAt: '2026-01-01',
      },
    ]);
    const items = buildNearbyItems(origin, facilities, parking, new Set());
    expect(items[0]?.kind).toBe('parking');
    expect(items[0]?.id).toBe('p50');
  });
});

describe('buildFilteredNearbyItems / countNearby', () => {
  const facilities = parseFacilities([
    facility('far', 'toilet', 2500),
    facility('t300', 'toilet', 300),
    facility('e100', 'elevator', 100),
    facility('e200', 'elevator', 200),
  ]);

  it('類別篩選只列該類設施，不含停車', () => {
    expect(buildFilteredNearbyItems(origin, facilities, [], 'elevator').map((item) => item.id)).toEqual(['e100', 'e200']);
    expect(buildFilteredNearbyItems(origin, facilities, [], 'parking')).toEqual([]);
    expect(buildFilteredNearbyItems(origin, facilities, [], 'all').map((item) => item.id)).toEqual(['e100', 'e200', 't300']);
  });

  it('數量只算半徑內', () => {
    expect(countNearby(origin, facilities, [])).toEqual({ elevator: 2, ramp: 0, toilet: 1, parking: 0 });
  });
});
