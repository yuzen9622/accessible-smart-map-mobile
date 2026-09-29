// 導航鏡頭規則，移植自 Web `src/hook/useNavigation.ts`（commit 5eadc71）的常數與 gpsNearRoute／navZoomForLeg。
// 差異：Web 在 rAF 每幀 jumpTo 跟隨；原生改交給 maplibre `trackUserLocation`，這裡只決定模式與參數。

import type { NavInstruction } from '@/features/route/domain';

import { isVehicleLegType, resolveActiveLegType } from './legMode';
import type { NavViewMode } from './types';

export const NAV_PITCH = 60;
export const NAV_ZOOM = 18.3;
/** 開車需要看到更多前方道路。 */
export const NAV_ZOOM_VEHICLE = 17.3;
// GPS 是否靠近路線（`gpsNearRoute`、`FOLLOW_GPS_MAX_M`）已在 navigationEngine，鏡頭共用同一個判斷。

export function navZoomForLeg(vehicle: boolean): number {
  return vehicle ? NAV_ZOOM_VEHICLE : NAV_ZOOM;
}

export function navPitch(viewMode: NavViewMode): number {
  return viewMode === '2d' ? 0 : NAV_PITCH;
}

export interface NavFollowParams {
  /** 步行：羅盤朝向（heading）；開車：行進方向（course，羅盤會跟著手機支架轉）。 */
  mode: 'heading' | 'course';
  zoom: number;
  pitch: number;
}

export function navFollowParams(
  instructions: readonly NavInstruction[],
  currentStepIndex: number,
  firstLegType: NavInstruction['legType'] | undefined,
  viewMode: NavViewMode,
): NavFollowParams {
  const legType = resolveActiveLegType(instructions, currentStepIndex) ?? firstLegType ?? null;
  const vehicle = isVehicleLegType(legType);
  return { mode: vehicle ? 'course' : 'heading', zoom: navZoomForLeg(vehicle), pitch: navPitch(viewMode) };
}
