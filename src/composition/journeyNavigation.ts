import { router } from 'expo-router';

import { useIndoorStore } from '@/features/indoor';
import { sheetNavigation } from '@/features/map';
import { beginNavigation } from '@/features/navigation';
import { getRouteSessionSnapshot } from '@/features/route/hooks/useRouteSession';
import type { BackgroundLocationTexts } from '@/shared/location';

/** 同一個開始導航入口；只有戶外路段交給 GPS 引擎。 */
export function beginJourneyNavigation(texts: BackgroundLocationTexts, kind?: 'handoff'): void {
  if (kind === 'handoff') {
    sheetNavigation.whenVisible(() => router.navigate({ pathname: '/navigation', params: { indoor: 'handoff' } }));
    return;
  }
  if (getRouteSessionSnapshot().indoorRoute) {
    sheetNavigation.whenVisible(() => router.navigate({ pathname: '/navigation', params: { indoor: 'start' } }));
    return;
  }
  useIndoorStore.getState().clearRoute();
  beginNavigation(texts);
}
