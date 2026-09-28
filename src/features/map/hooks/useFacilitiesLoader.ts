import { useEffect } from 'react';

import { fetchFacilities, readCachedFacilities } from '../api/facilities';
import { useFacilityStore } from '../store/facilityStore';

/** 啟動時先用 MMKV 快取立刻顯示，過期（或沒有快取）才打 API。整個 App 只需掛一次。 */
export function useFacilitiesLoader(): void {
  const setFacilities = useFacilityStore((state) => state.setFacilities);
  const setLoadError = useFacilityStore((state) => state.setLoadError);

  useEffect(() => {
    const controller = new AbortController();
    const cached = readCachedFacilities();
    if (cached) setFacilities(cached.facilities);
    if (cached?.fresh) return () => controller.abort();

    const load = async () => {
      try {
        setFacilities(await fetchFacilities(controller.signal));
      } catch (error) {
        if (!controller.signal.aborted && !cached) setLoadError(String(error));
      }
    };
    void load();
    return () => controller.abort();
  }, [setFacilities, setLoadError]);
}
