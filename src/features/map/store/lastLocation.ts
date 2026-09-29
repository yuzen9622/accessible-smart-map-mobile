import { appStorage } from '@/shared/storage';

import { LAST_USER_LOCATION_KEY } from '../domain/initialCamera';

/** 設定 → 資料管理：是否有上次定位快取、清除快取（用來在冷啟動初始化地圖相機）。 */
export function hasLastUserLocation(): boolean {
  return appStorage.getString(LAST_USER_LOCATION_KEY) !== undefined;
}

export function clearLastUserLocation(): void {
  appStorage.remove(LAST_USER_LOCATION_KEY);
}
