import { expoLocationPort } from './expo-location-port';
import type { LocationPort } from './types';

let currentPort: LocationPort = expoLocationPort;

/** 目前使用中的 `LocationPort`（預設是 `expoLocationPort`）。 */
export function getLocationPort(): LocationPort {
  return currentPort;
}

/** 測試或情境切換時注入替代實作；不傳參數則還原成 `expoLocationPort`。 */
export function configureLocationPort(port: LocationPort = expoLocationPort): void {
  currentPort = port;
}
