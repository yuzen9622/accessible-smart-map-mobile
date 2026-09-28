import { create } from 'zustand';

import type { LatLng } from '@/shared/geo';
import type { LocationPermissionStatus } from '@/shared/location';

interface UserLocationState {
  position: LatLng | null;
  heading: number | null;
  permission: LocationPermissionStatus | 'unknown';
  /** GPS 目前是否處於錯誤狀態（隧道、地下室、權限被收回） */
  gpsError: boolean;
  setPosition: (position: LatLng) => void;
  setHeading: (heading: number | null) => void;
  setPermission: (permission: LocationPermissionStatus) => void;
  setGpsError: (gpsError: boolean) => void;
}

export const useUserLocationStore = create<UserLocationState>()((set) => ({
  position: null,
  heading: null,
  permission: 'unknown',
  gpsError: false,
  setPosition: (position) => set({ position, gpsError: false }),
  setHeading: (heading) => set({ heading }),
  setPermission: (permission) => set({ permission }),
  setGpsError: (gpsError) => set({ gpsError }),
}));
