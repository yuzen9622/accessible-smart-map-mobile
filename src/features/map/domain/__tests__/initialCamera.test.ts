import { DEFAULT_CENTER, isLatLng, resolveInitialCamera } from '../initialCamera';

describe('resolveInitialCamera', () => {
  it('有上次位置時以它為中心、zoom 17', () => {
    expect(resolveInitialCamera({ lat: 25.03, lng: 121.56 })).toEqual({ center: { lat: 25.03, lng: 121.56 }, zoom: 17 });
  });

  it('沒有時回到預設中心、zoom 15', () => {
    expect(resolveInitialCamera(null)).toEqual({ center: DEFAULT_CENTER, zoom: 15 });
  });
});

describe('isLatLng', () => {
  it('只接受有限數值的 lat/lng', () => {
    expect(isLatLng({ lat: 25, lng: 121 })).toBe(true);
    expect(isLatLng({ lat: Number.NaN, lng: 121 })).toBe(false);
    expect(isLatLng({ lat: '25', lng: 121 })).toBe(false);
    expect(isLatLng(null)).toBe(false);
  });
});
