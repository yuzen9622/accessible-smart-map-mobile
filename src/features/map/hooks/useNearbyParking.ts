import { useEffect } from 'react';

import { fetchNearbyParking } from '../api/parking';
import { useParkingStore } from '../store/parkingStore';
import { useUserLocationStore } from '../store/userLocationStore';
import { useFetchLocation } from './useFetchLocation';

/** 使用者位置移動 ≥ 100 m 才重查附近停車（Web A11yPanel.tsx:71-77）。 */
export function useNearbyParking(): void {
  const position = useUserLocationStore((state) => state.position);
  const fetchLoc = useFetchLocation(position);
  const setItems = useParkingStore((state) => state.setItems);

  useEffect(() => {
    if (!fetchLoc) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        setItems(await fetchNearbyParking(fetchLoc, controller.signal));
      } catch (error) {
        if (!controller.signal.aborted) console.warn('[parking] nearby fetch failed', error);
      }
    };
    void load();
    return () => controller.abort();
  }, [fetchLoc, setItems]);
}
