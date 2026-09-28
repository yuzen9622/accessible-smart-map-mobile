import { haversineMeters, lngLatToLatLng } from '../geo';

describe('haversineMeters', () => {
  it('台北車站到台北 101 約 5.1 km', () => {
    const d = haversineMeters({ lat: 25.0478, lng: 121.517 }, { lat: 25.034, lng: 121.5645 });
    expect(d).toBeGreaterThan(4900);
    expect(d).toBeLessThan(5200);
  });

  it('同一點為 0', () => {
    expect(haversineMeters({ lat: 25, lng: 121 }, { lat: 25, lng: 121 })).toBe(0);
  });
});

describe('lngLatToLatLng', () => {
  it('把 GeoJSON [lng, lat] 轉成 LatLng，非有限值回 null', () => {
    expect(lngLatToLatLng([121.5, 25.05])).toEqual({ lat: 25.05, lng: 121.5 });
    expect(lngLatToLatLng([Number.NaN, 25])).toBeNull();
    expect(lngLatToLatLng(['121', 25])).toBeNull();
    expect(lngLatToLatLng(undefined)).toBeNull();
  });
});
