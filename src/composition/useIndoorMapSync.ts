import { usePathname } from 'expo-router';
import { useEffect } from 'react';

import { useIndoorStore } from '@/features/indoor';
import { useNavStore } from '@/features/navigation';
import { usePlaceUiStore } from '@/features/place';
import { useRouteSession } from '@/features/route';

/** 原本搜尋與路線 session 驅動同一張地圖；室內模組只呈現目前的圖資與執行步驟。 */
export function useIndoorMapSync() {
  const selectedPlace = usePlaceUiStore((state) => state.selectedPlace);
  const indoorRoute = useRouteSession((state) => state.indoorRoute);
  const venueLeg = useRouteSession((state) => state.venueLeg);
  const outdoorNavigating = useNavStore((state) => state.isNavigating);
  const pathname = usePathname();

  useEffect(() => {
    if (!selectedPlace || pathname === '/navigation' || outdoorNavigating) return;
    if (selectedPlace.kind !== 'venue-place') {
      useIndoorStore.getState().exitVenue();
      return;
    }
    let current = true;
    void (async () => {
      const state = useIndoorStore.getState();
      if (state.venue.status !== 'ready' || state.venue.data.venueId !== selectedPlace.venueId || state.venue.data.version !== selectedPlace.sourceVersion) {
        await state.selectVenue(selectedPlace.venueId);
      }
      if (!current) return;
      const latest = useIndoorStore.getState();
      if (latest.selectedVenueId !== selectedPlace.venueId) return;
      latest.resume();
      latest.selectPlace(selectedPlace.placeId);
    })();
    return () => { current = false; };
  }, [selectedPlace, pathname, outdoorNavigating]);

  useEffect(() => {
    if (outdoorNavigating) { useIndoorStore.getState().suspend(); return; }
    if (pathname === '/navigation') return;
    if (indoorRoute) {
      const state = useIndoorStore.getState();
      if (state.plan.status === 'ready' && state.plan.data === indoorRoute) { state.resume(); return; }
      const controller = new AbortController();
      void state.adoptRoute(indoorRoute, controller.signal);
      return () => controller.abort();
    } else if (!venueLeg) {
      useIndoorStore.getState().clearRoute();
    }
  }, [indoorRoute, venueLeg, outdoorNavigating, pathname]);
}
