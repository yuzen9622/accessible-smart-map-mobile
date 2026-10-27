import { useEffect } from 'react';

import { logger } from '@/shared/logger';
import { appStateVisibility, createPoller } from '@/shared/polling';

import { fetchEnvironment } from '../api/environment';
import { useEnvironmentStore } from '../store/environmentStore';
import { useUserLocationStore } from '../store/userLocationStore';
import { useFetchLocation } from './useFetchLocation';

const ENVIRONMENT_REFRESH_MS = 60_000;

/** 移動 ≥ 100 m 換點查詢；停在原地也每分鐘重試，回前景立即刷新。 */
export function useEnvironment(): void {
  const position = useUserLocationStore((state) => state.position);
  const fetchLoc = useFetchLocation(position);
  const setInfo = useEnvironmentStore((state) => state.setInfo);

  useEffect(() => {
    if (!fetchLoc) return;
    const poller = createPoller({
      intervalMs: ENVIRONMENT_REFRESH_MS,
      visibility: appStateVisibility,
      task: async ({ signal }) => {
        try {
          const info = await fetchEnvironment(fetchLoc, signal);
          if (!signal.aborted) setInfo(info);
        } catch (error) {
          if (!signal.aborted) logger.warn('[environment] fetch failed', error);
        }
      },
    });
    poller.start();
    return () => poller.stop();
  }, [fetchLoc, setInfo]);
}
