import * as Location from 'expo-location';

import type {
  GeoPosition,
  GetCurrentOptions,
  LocationAccuracyLevel,
  LocationPermissionStatus,
  LocationPort,
  Unsubscribe,
  WatchOptions,
} from './types';

const ACCURACY_MAP: Record<LocationAccuracyLevel, Location.LocationAccuracy> = {
  lowest: Location.LocationAccuracy.Lowest,
  low: Location.LocationAccuracy.Low,
  balanced: Location.LocationAccuracy.Balanced,
  high: Location.LocationAccuracy.High,
  highest: Location.LocationAccuracy.Highest,
  'best-for-navigation': Location.LocationAccuracy.BestForNavigation,
};

function toAccuracy(level: LocationAccuracyLevel | undefined): Location.LocationAccuracy | undefined {
  return level ? ACCURACY_MAP[level] : undefined;
}

function toPermissionStatus(status: Location.PermissionStatus): LocationPermissionStatus {
  switch (status) {
    case Location.PermissionStatus.GRANTED:
      return 'granted';
    case Location.PermissionStatus.DENIED:
      return 'denied';
    default:
      return 'undetermined';
  }
}

/**
 * expo-location `LocationObject` → app 內共用的 `GeoPosition`。
 * 匯出供測試直接呼叫，避免測試檔重寫一份映射邏輯。
 */
export function mapLocationObjectToGeoPosition(location: Location.LocationObject): GeoPosition {
  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracy: location.coords.accuracy,
    heading: location.coords.heading,
    speed: location.coords.speed,
    timestamp: location.timestamp,
  };
}

async function getPermissionStatus(): Promise<LocationPermissionStatus> {
  const response = await Location.getForegroundPermissionsAsync();
  return toPermissionStatus(response.status);
}

async function requestForegroundPermission(): Promise<LocationPermissionStatus> {
  const response = await Location.requestForegroundPermissionsAsync();
  return toPermissionStatus(response.status);
}

async function getCurrent(options?: GetCurrentOptions): Promise<GeoPosition> {
  const location = await Location.getCurrentPositionAsync({
    accuracy: toAccuracy(options?.accuracy),
  });
  return mapLocationObjectToGeoPosition(location);
}

async function watch(
  options: WatchOptions,
  onUpdate: (position: GeoPosition) => void,
): Promise<Unsubscribe> {
  const subscription = await Location.watchPositionAsync(
    {
      accuracy: toAccuracy(options.accuracy),
      timeInterval: options.timeIntervalMs,
      distanceInterval: options.distanceIntervalMeters,
    },
    (location) => {
      onUpdate(mapLocationObjectToGeoPosition(location));
    },
  );
  return () => subscription.remove();
}

async function watchHeading(onUpdate: (headingDegrees: number) => void): Promise<Unsubscribe> {
  const subscription = await Location.watchHeadingAsync((heading) => {
    onUpdate(heading.trueHeading >= 0 ? heading.trueHeading : heading.magHeading);
  });
  return () => subscription.remove();
}

export const expoLocationPort: LocationPort = {
  getPermissionStatus,
  requestForegroundPermission,
  getCurrent,
  watch,
  watchHeading,
};
