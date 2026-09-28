import { create } from 'zustand';

import type { LatLng } from '@/shared/geo';
import type { LocationPermissionStatus } from '@/shared/location';

interface UserLocationState {
  position: LatLng | null;
  heading: number | null;
  /** GPS 對地航向（度，0 = 北）；速度太慢或來源未回報時為 null。導航開車時以它為準（羅盤會跟著手機支架轉）。 */
  course: number | null;
  /** 導航進行中：定位監看升到 best-for-navigation（導航 feature 經公開 API 切換）。 */
  navigationAccuracy: boolean;
  permission: LocationPermissionStatus | 'unknown';
  /** GPS 目前是否處於錯誤狀態（隧道、地下室、權限被收回） */
  gpsError: boolean;
  setPosition: (position: LatLng) => void;
  setHeading: (heading: number | null) => void;
  setCourse: (course: number | null) => void;
  setNavigationAccuracy: (on: boolean) => void;
  setPermission: (permission: LocationPermissionStatus) => void;
  setGpsError: (gpsError: boolean) => void;
}

export const useUserLocationStore = create<UserLocationState>()((set) => ({
  position: null,
  heading: null,
  course: null,
  navigationAccuracy: false,
  permission: 'unknown',
  gpsError: false,
  setPosition: (position) => set({ position, gpsError: false }),
  setHeading: (heading) => set({ heading }),
  // iOS 在航向無效時回報 -1；一律正規化成 null。
  setCourse: (course) => set({ course: course != null && Number.isFinite(course) && course >= 0 ? course : null }),
  setNavigationAccuracy: (navigationAccuracy) => set({ navigationAccuracy }),
  setPermission: (permission) => set({ permission }),
  setGpsError: (gpsError) => set({ gpsError }),
}));
