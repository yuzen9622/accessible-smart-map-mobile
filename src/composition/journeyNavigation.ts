import { router } from 'expo-router';

import { useIndoorStore } from '@/features/indoor';
import { sheetNavigation } from '@/features/map';
import { beginNavigation } from '@/features/navigation';
import { getRouteSessionSnapshot } from '@/features/route';
import type { BackgroundLocationTexts } from '@/shared/location';

/** 同一個開始導航入口；只有戶外路段交給 GPS 引擎。 */
export function beginJourneyNavigation(texts: BackgroundLocationTexts): void {
  if (getRouteSessionSnapshot().indoorRoute) {
    sheetNavigation.whenVisible(() => router.navigate({ pathname: '/navigation', params: { indoor: 'start' } }));
    return;
  }
  useIndoorStore.getState().clearRoute();
  beginNavigation(texts);
}
