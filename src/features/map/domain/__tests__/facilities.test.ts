import { parseFacilities, parseFacility, toFacilityCollection, type Facility } from '../facilities';

const metro = {
  _id: 'm1',
  name: '台北車站 M8 電梯',
  location: { type: 'Point', coordinates: [121.517, 25.0478] },
  category: 'elevator',
  source: 'metro',
  exitName: 'M8',
};

describe('parseFacility', () => {
  it('解析捷運電梯，保留出口名稱', () => {
    expect(parseFacility(metro)).toEqual<Facility>({
      id: 'm1',
      name: '台北車站 M8 電梯',
      category: 'elevator',
      source: 'metro',
      lng: 121.517,
      lat: 25.0478,
      exitName: 'M8',
      wheelchair: null,
      schoolName: null,
    });
  });

  it('parking／other 類別不畫 pin，丟棄', () => {
    expect(parseFacility({ ...metro, category: 'parking' })).toBeNull();
    expect(parseFacility({ ...metro, category: 'other' })).toBeNull();
  });

  it('座標缺漏或非有限值時丟棄', () => {
    expect(parseFacility({ ...metro, location: { type: 'Point', coordinates: [Number.NaN, 25] } })).toBeNull();
    expect(parseFacility({ ...metro, location: null })).toBeNull();
  });

  it('OSM wheelchair 只接受 yes/limited/no', () => {
    expect(parseFacility({ ...metro, source: 'osm', osmId: 'n1', wheelchair: 'limited' })?.wheelchair).toBe('limited');
    expect(parseFacility({ ...metro, source: 'osm', osmId: 'n1', wheelchair: 'maybe' })?.wheelchair).toBeNull();
  });
});

describe('parseFacilities', () => {
  it('非陣列回空陣列，混雜資料只留合法項', () => {
    expect(parseFacilities(null)).toEqual([]);
    expect(parseFacilities([metro, { bad: true }])).toHaveLength(1);
  });
});

describe('toFacilityCollection', () => {
  const facilities = parseFacilities([
    metro,
    { ...metro, _id: 't1', category: 'toilet', source: 'bathroom' },
    { ...metro, _id: 'r1', category: 'ramp', source: 'osm' },
  ]);

  it('只輸出選取類別的點，座標為 [lng, lat]', () => {
    const collection = toFacilityCollection(facilities, new Set(['toilet']));
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0]?.properties.id).toBe('t1');
    expect(collection.features[0]?.geometry.coordinates).toEqual([121.517, 25.0478]);
  });

  it('沒有選取任何類別時不畫任何點', () => {
    expect(toFacilityCollection(facilities, new Set()).features).toHaveLength(0);
  });
});
