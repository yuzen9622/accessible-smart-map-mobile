import { nearbyFacilityRows } from '../nearbyFacilityRows';

const format = (meters: number) => `${Math.round(meters)} m`;
const labels = { toilet: '廁所', elevator: '電梯', ramp: '坡道', other: '無障礙設施' };

describe('nearbyFacilityRows', () => {
  it('returns an empty list when no response is available', () => {
    expect(nearbyFacilityRows(null, format, labels)).toEqual([]);
  });

  it('displays real campus entries without treating every facility as an elevator', () => {
    const rows = nearbyFacilityRows({
      nearbyBathroom: [],
      nearbyMetroA11y: [
        { '項次': 'toilet-1', facType: 'accessible_toilet', facTypeLabel: '無障礙廁所', '出入口電梯/無障礙坡道名稱': '無障礙廁所', distanceMeters: 12.4 },
        { '項次': 'path-1', facType: 'outdoor_path', facTypeLabel: '室外通路', '出入口電梯/無障礙坡道名稱': '無障礙坡道', distanceMeters: 13.86 },
        { '項次': 'ramp-1', facType: 'ramp', facTypeLabel: '無障礙坡道', '出入口電梯/無障礙坡道名稱': '無障礙坡道', distanceMeters: 15.15 },
        { '項次': 'stairs-1', facType: 'accessible_stairs', facTypeLabel: '無障礙樓梯', '出入口電梯/無障礙坡道名稱': '無障礙樓梯', distanceMeters: 22.63 },
      ],
    }, format, labels);

    expect(rows.map(({ name, typeLabel, kind, distanceText }) => ({ name, typeLabel, kind, distanceText }))).toEqual([
      { name: '無障礙廁所', typeLabel: '無障礙廁所', kind: 'toilet', distanceText: '12 m' },
      { name: '無障礙坡道', typeLabel: '室外通路', kind: 'other', distanceText: '14 m' },
      { name: '無障礙坡道', typeLabel: '無障礙坡道', kind: 'ramp', distanceText: '15 m' },
      { name: '無障礙樓梯', typeLabel: '無障礙樓梯', kind: 'other', distanceText: '23 m' },
    ]);
  });

  it('uses at most four records per API list in the same source order as Web', () => {
    const rows = nearbyFacilityRows({
      nearbyBathroom: Array.from({ length: 6 }, (_, i) => ({ _id: `bath-${i}`, name: `廁所 ${i}`, distanceMeters: 50 - i })),
      nearbyMetroA11y: Array.from({ length: 6 }, (_, i) => ({ '項次': `facility-${i}`, '出入口電梯/無障礙坡道名稱': `設施 ${i}`, category: 'elevator', distanceMeters: i })),
    }, format, labels);

    expect(rows.map((row) => row.name)).toEqual(['廁所 0', '廁所 1', '廁所 2', '廁所 3', '設施 0', '設施 1', '設施 2', '設施 3']);
    expect(new Set(rows.map((row) => row.key)).size).toBe(8);
  });

  it('prefers display fields and preserves records without a distance', () => {
    const rows = nearbyFacilityRows({
      nearbyBathroom: [{ _id: 'b1', name: '原名', displayName: '顯示名稱', address: '原地址', displayAddress: '顯示地址' }],
      nearbyMetroA11y: [{ osmId: '123', category: 'elevator', name: '無障礙電梯', distanceMeters: Number.NaN }],
    }, format, labels);

    expect(rows[0]).toMatchObject({ name: '顯示名稱', address: '顯示地址', kind: 'toilet', typeLabel: '廁所', distanceText: '' });
    expect(rows[1]).toMatchObject({ name: '無障礙電梯', kind: 'elevator', typeLabel: '電梯', distanceText: '' });
  });

  it('shows metro exit information when no address is available', () => {
    const rows = nearbyFacilityRows({ nearbyBathroom: [], nearbyMetroA11y: [
      { source: 'metro', '項次': 'e1', '出入口電梯/無障礙坡道名稱': '無障礙電梯', '出入口編號': '出口 1', distanceMeters: 30 },
    ] }, format, labels);
    expect(rows[0]).toMatchObject({ name: '無障礙電梯', address: '出口 1', kind: 'elevator' });
  });

  it('classifies metro names without reclassifying campus records', () => {
    const rows = nearbyFacilityRows({
      nearbyBathroom: [],
      nearbyMetroA11y: [
        { source: 'metro', '項次': '1', '出入口電梯/無障礙坡道名稱': '捷運站出口電梯', distanceMeters: 10 },
        { source: 'metro', '項次': '2', '出入口電梯/無障礙坡道名稱': '捷運站無障礙坡道', distanceMeters: 20 },
        { source: 'metro', '項次': '3', '出入口電梯/無障礙坡道名稱': '電梯及坡道', distanceMeters: 30 },
        { source: 'campus', facType: 'outdoor_path', facTypeLabel: '室外通路', '項次': '4', '出入口電梯/無障礙坡道名稱': '無障礙坡道', distanceMeters: 40 },
      ],
    }, format, labels);

    expect(rows.map(({ kind, typeLabel }) => ({ kind, typeLabel }))).toEqual([
      { kind: 'elevator', typeLabel: '電梯' },
      { kind: 'ramp', typeLabel: '坡道' },
      { kind: 'elevator', typeLabel: '電梯' },
      { kind: 'other', typeLabel: '室外通路' },
    ]);
  });

  it('ignores malformed records and does not invent a facility type', () => {
    const rows = nearbyFacilityRows({
      nearbyBathroom: [null, {}, 'bad'],
      nearbyMetroA11y: [{ '項次': 'one', '出入口電梯/無障礙坡道名稱': '某出入口', distanceMeters: -1 }],
    }, format, labels);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: '某出入口', typeLabel: '無障礙設施', kind: 'other', distanceText: '' });
  });
});
