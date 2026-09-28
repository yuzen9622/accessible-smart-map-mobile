import type * as Location from 'expo-location';

import { mapLocationObjectToGeoPosition } from '../expo-location-port';

describe('mapLocationObjectToGeoPosition', () => {
  it('把 expo-location LocationObject 映射成 GeoPosition（欄位改名＋攤平 coords）', () => {
    const location: Location.LocationObject = {
      coords: {
        latitude: 25.033,
        longitude: 121.5654,
        altitude: 10,
        accuracy: 5,
        altitudeAccuracy: 3,
        heading: 90,
        speed: 1.5,
      },
      timestamp: 1_726_000_000_000,
    };

    expect(mapLocationObjectToGeoPosition(location)).toEqual({
      lat: 25.033,
      lng: 121.5654,
      accuracy: 5,
      heading: 90,
      speed: 1.5,
      timestamp: 1_726_000_000_000,
    });
  });

  it('coords 的 accuracy／heading／speed 為 null 時原樣保留（不轉成 0）', () => {
    const location: Location.LocationObject = {
      coords: {
        latitude: 0,
        longitude: 0,
        altitude: null,
        accuracy: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: 0,
    };

    const result = mapLocationObjectToGeoPosition(location);
    expect(result.accuracy).toBeNull();
    expect(result.heading).toBeNull();
    expect(result.speed).toBeNull();
  });
});
