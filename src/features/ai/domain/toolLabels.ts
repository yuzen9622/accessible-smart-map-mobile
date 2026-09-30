// 移植自 Web `src/lib/ai/toolLabels.ts`（commit f5027af）。Web 把中文字串寫死在 TOOL_LABELS／TOOL_LOADING_TEXT，
// 這裡改成 i18n key（`nativeAiToolDone_<name>`／`nativeAiToolLoading_<name>`），翻譯函式由呼叫端注入。
import type { Translate } from './types';

/** 後端 `src/config/ai/tool.ts` 有的工具；不在這張表的工具走 fallback（原始名稱）。 */
export const KNOWN_TOOL_NAMES: readonly string[] = [
  'findGooglePlaces',
  'findA11yPlaces',
  'getA11yFacilityDetails',
  'findCampusAccessibility',
  'getCampusAccessibilityDetails',
  'planAccessibleRoute',
  'getNavInstructions',
  'getBusRoute',
  'getBusRouteDetail',
  'getBusArrival',
  'getBusTimetable',
  'trackBuses',
  'findNearbyBusStops',
  'getAirQuality',
  'getEnvironmentInfo',
  'getNearbyHazards',
  'findNearbyParking',
  'saveMemory',
  'deleteMemory',
  'searchAccessibilityGuide',
  'webSearch',
  'planRoute',
  'getTrainTimetable',
  'getStationTimetable',
  'getMetroAlerts',
  'getTransitAlerts',
];

const KNOWN = new Set(KNOWN_TOOL_NAMES);

/** 進行中的文字，例如「正在查詢公車路線…」。未知工具退回 `正在${name}…`。 */
export function toolLoadingLabel(name: string, t: Translate): string {
  return KNOWN.has(name) ? t(`nativeAiToolLoading_${name}`) : t('nativeAiToolLoadingFallback', { name });
}

/** 已完成的文字，例如「查詢公車路線」。未知工具退回原始名稱。 */
export function toolDoneLabel(name: string, t: Translate): string {
  return KNOWN.has(name) ? t(`nativeAiToolDone_${name}`) : name;
}
