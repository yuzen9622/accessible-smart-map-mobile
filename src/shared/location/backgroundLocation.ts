import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { mapLocationObjectToGeoPosition } from './expo-location-port';
import type { GeoPosition } from './types';

/**
 * 背景定位（SDD §4.3 `LocationPort.startBackground`、§6.4）：導航進行中 App 進背景或鎖螢幕時，
 * 由 `expo-task-manager` 任務接手定位。任務只把位置交給註冊的 sink（map 的 `useUserLocationStore`），
 * 導航控制器照常從 store 驅動進度與播報，不操作 UI。
 *
 * `defineTask` 必須在 JS 頂層執行（App 從背景被喚醒時要找得到任務），所以本檔要在 root layout
 * 以副作用 import 載入。只在導航中啟用（SDD §9：背景定位只用於導航／SOS）。
 */
export const BACKGROUND_LOCATION_TASK = 'navigation-background-location';

type PositionSink = (position: GeoPosition) => void;
let sink: PositionSink | null = null;

interface LocationTaskData {
  locations: Location.LocationObject[];
}

function isLocationTaskData(data: unknown): data is LocationTaskData {
  return typeof data === 'object' && data !== null && Array.isArray((data as { locations?: unknown }).locations);
}

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error || !isLocationTaskData(data)) return;
  // 系統可能批次送來多筆（延遲更新）；導航只需要最新一筆。
  const latest = data.locations[data.locations.length - 1];
  if (latest) sink?.(mapLocationObjectToGeoPosition(latest));
});

/** 註冊背景位置的接收者；回傳取消註冊的函式。 */
export function setBackgroundPositionSink(next: PositionSink | null): () => void {
  sink = next;
  return () => {
    if (sink === next) sink = null;
  };
}

export interface BackgroundLocationTexts {
  /** Android 前景服務通知標題／內容（鎖定畫面常駐通知）。 */
  notificationTitle: string;
  notificationBody: string;
}

/**
 * 開始背景定位。iOS 需要「永遠允許」；使用者只給「使用 App 期間」時回傳 false，
 * 導航仍以前景定位運作（呼叫端決定是否提示）。
 */
export async function startBackgroundLocation(texts: BackgroundLocationTexts): Promise<boolean> {
  const foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== Location.PermissionStatus.GRANTED) return false;
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== Location.PermissionStatus.GRANTED) return false;
  if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) return true;
  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.LocationAccuracy.BestForNavigation,
    distanceInterval: 2,
    timeInterval: 1000,
    activityType: Location.LocationActivityType.OtherNavigation,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: texts.notificationTitle,
      notificationBody: texts.notificationBody,
      killServiceOnDestroy: true,
    },
  });
  return true;
}

export async function stopBackgroundLocation(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
