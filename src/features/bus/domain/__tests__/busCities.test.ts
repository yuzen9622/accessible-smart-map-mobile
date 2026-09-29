import { busCityLabel, groupByCity } from '../busCities';

describe('busCityLabel', () => {
  it('maps known codes and keeps unknown ones', () => {
    expect(busCityLabel('Taipei')).toBe('台北市');
    expect(busCityLabel('InterCity')).toBe('公路公車');
    expect(busCityLabel('Mars')).toBe('Mars');
  });
});

describe('groupByCity', () => {
  it('groups by city in first-seen order and keeps item order', () => {
    const groups = groupByCity([
      { city: 'Taipei', id: 1 },
      { city: 'NewTaipei', id: 2 },
      { city: 'Taipei', id: 3 },
    ]);
    expect(groups.map((g) => g.label)).toEqual(['台北市', '新北市']);
    expect(groups[0]?.items.map((i) => i.id)).toEqual([1, 3]);
  });

  it('returns empty for empty input', () => {
    expect(groupByCity([])).toEqual([]);
  });
});
