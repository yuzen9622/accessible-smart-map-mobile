import { useEffect } from 'react';

import { fetchNearbyParking } from '../api/parking';
import { useParkingStore } from '../store/parkingStore';
import { useUserLocationStore } from '../store/userLocationStore';
import { useFetchLocation } from './useFetchLocation';
import { logger } from '@/shared/logger';
import { getAppLanguage, useAppTranslation } from '@/shared/i18n';

/** 使用者位置移動 ≥ 100 m 才重查附近停車（Web A11yPanel.tsx:71-77）。 */
export function useNearbyParking(): void {
  useAppTranslation();
  const lang = getAppLanguage();
  const position = useUserLocationStore((state) => state.position);
  const fetchLoc = useFetchLocation(position);
  const setItems = useParkingStore((state) => state.setItems);

  useEffect(() => {
    setItems(null);
    if (!fetchLoc) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const items = await fetchNearbyParking(fetchLoc, controller.signal, lang);
        if (!controller.signal.aborted) setItems(items);
      } catch (error) {
        if (!controller.signal.aborted) logger.warn('[parking] nearby fetch failed', error);
      }
    };
    void load();
    return () => controller.abort();
  }, [fetchLoc, lang, setItems]);
}
