import { useEffect } from 'react';
import { getAppLanguage, useAppTranslation } from '@/shared/i18n';

import { fetchFacilities, readCachedFacilities } from '../api/facilities';
import { useFacilityStore } from '../store/facilityStore';

/** 啟動時先用 MMKV 快取立刻顯示，過期（或沒有快取）才打 API。整個 App 只需掛一次。 */
export function useFacilitiesLoader(): void {
  useAppTranslation();
  const lang = getAppLanguage();
  const setFacilities = useFacilityStore((state) => state.setFacilities);
  const setLoadError = useFacilityStore((state) => state.setLoadError);

  useEffect(() => {
    const controller = new AbortController();
    const cached = readCachedFacilities(Date.now(), lang);
    setFacilities(cached?.facilities ?? null);
    if (cached?.fresh) return () => controller.abort();

    const load = async () => {
      try {
        const facilities = await fetchFacilities(controller.signal, lang);
        if (!controller.signal.aborted) setFacilities(facilities);
      } catch (error) {
        if (!controller.signal.aborted && !cached) setLoadError(String(error));
      }
    };
    void load();
    return () => controller.abort();
  }, [lang, setFacilities, setLoadError]);
}
