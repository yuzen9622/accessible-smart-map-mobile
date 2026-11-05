// 移植自 Web `src/lib/__tests__/geo-incidents.test.ts`（commit 5eadc71），案例逐一保留。
import type { DriveIncident } from '../../types/route';
import { filterIncidentsAlongRoute, filterPointsAlongRoute, pointToPolylineDistanceM } from '../geo';

describe('pointToPolylineDistanceM', () => {
  const polyline: [number, number][] = [
    [121.5, 25.0],
    [121.51, 25.0],
  ];

  it('returns 0 for points directly on the polyline', () => {
    expect(pointToPolylineDistanceM({ lat: 25.0, lng: 121.505 }, polyline)).toBeLessThan(1);
  });

  it('calculates perpendicular distance accurately', () => {
    // 0.001 度緯度約 111 公尺
    const dist = pointToPolylineDistanceM({ lat: 25.001, lng: 121.505 }, polyline);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(125);
  });

  it('returns Infinity for empty polyline', () => {
    expect(pointToPolylineDistanceM({ lat: 25.0, lng: 121.5 }, [])).toBe(Infinity);
  });
});

describe('filterIncidentsAlongRoute', () => {
  // 台中的一段路線，經過 120.6946, 24.1455
  const taichungPolyline: [number, number][] = [
    [120.694, 24.145],
    [120.695, 24.146],
    [120.696, 24.147],
  ];

  const sampleIncidents: DriveIncident[] = [
    {
      incidentId: 'tc-1',
      title: '道路施工',
      description: '大樁建設總部大樓新建工程',
      location: { lat: 24.1455, lng: 120.6946 }, // 就在路線旁（約 15 m）
      severity: 'advisory',
    },
    {
      incidentId: 'tc-far',
      title: '道路施工',
      description: '遠處施工',
      location: { lat: 24.1816, lng: 120.7025 }, // 北台中，約 5.5 km
      severity: 'advisory',
    },
    {
      incidentId: 'taipei-1',
      title: '道路施工',
      description: '台北車站道路維護',
      location: { lat: 25.0459, lng: 121.5031 }, // 台北，約 130 km
      severity: 'advisory',
    },
    {
      incidentId: 'bad-loc',
      title: '錯誤座標',
      description: '無效資料',
      location: { lat: Number.NaN, lng: 120.694 },
      severity: 'advisory',
    },
  ];

  it('retains only incidents within 150m of the polyline', () => {
    const filtered = filterIncidentsAlongRoute(sampleIncidents, taichungPolyline, 150);
    expect(filtered.map((i) => i.incidentId)).toEqual(['tc-1']);
  });

  it('handles empty or undefined inputs gracefully', () => {
    expect(filterIncidentsAlongRoute(undefined, taichungPolyline)).toEqual([]);
    expect(filterIncidentsAlongRoute(sampleIncidents, undefined)).toEqual([]);
    expect(filterIncidentsAlongRoute([], [])).toEqual([]);
  });
});

describe('filterPointsAlongRoute', () => {
  // 跨越多個格子的長線段（約 11 km）、轉折與格線附近的點，結果要與逐段比對一致。
  const polyline: [number, number][] = [
    [120.68, 24.13],
    [120.79, 24.13],
    [120.795, 24.2001],
    [120.7951, 24.2002],
  ];
  const points = Array.from({ length: 400 }, (_, i) => ({
    id: i,
    lng: 120.67 + (i % 20) * 0.007 + (i % 7) * 0.0003,
    lat: 24.125 + Math.floor(i / 20) * 0.0042 + (i % 3) * 0.0004,
  }));
  points.push({ id: 400, lng: 120.735, lat: 24.13 + 0.0008 }, { id: 401, lng: 120.735, lat: 24.13 + 0.0011 });

  it('matches the per-point polyline distance check', () => {
    const expected = points.filter((point) => pointToPolylineDistanceM(point, polyline) <= 100).map((point) => point.id);
    expect(expected.length).toBeGreaterThan(5);
    expect(filterPointsAlongRoute(points, polyline, 100).map((point) => point.id)).toEqual(expected);
  });

  it('includes a point about 89 m from a long segment and excludes one about 122 m away', () => {
    expect(filterPointsAlongRoute(points.slice(400), polyline, 100).map((point) => point.id)).toEqual([400]);
  });

  it('handles a single-point polyline', () => {
    expect(filterPointsAlongRoute([{ lat: 24.13, lng: 120.68 }], [[120.68, 24.1305]], 100)).toHaveLength(1);
  });
});
