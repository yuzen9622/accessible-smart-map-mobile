import { useEffect } from 'react';

import { logger } from '@/shared/logger';

import { fetchEnvironment } from '../api/environment';
import { useEnvironmentStore } from '../store/environmentStore';
import { useUserLocationStore } from '../store/userLocationStore';
import { useFetchLocation } from './useFetchLocation';

/** 使用者位置移動 ≥ 100 m（跟 `useNearbyParking` 同門檻）才重查天氣／空氣品質；
 * 兩者都是慢變化資料，不需要更密的重查頻率。 */
export function useEnvironment(): void {
  const position = useUserLocationStore((state) => state.position);
  const fetchLoc = useFetchLocation(position);
  const setInfo = useEnvironmentStore((state) => state.setInfo);

  useEffect(() => {
    if (!fetchLoc) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        setInfo(await fetchEnvironment(fetchLoc, controller.signal));
      } catch (error) {
        if (!controller.signal.aborted) logger.warn('[environment] fetch failed', error);
      }
    };
    void load();
    return () => controller.abort();
  }, [fetchLoc, setInfo]);
}
