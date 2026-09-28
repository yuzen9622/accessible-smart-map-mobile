// 移植自 Web src/hook/useFetchLocation.ts（5eadc71）：距離門檻 gate，GPS 小抖動不會重跑依賴它的 fetch effect。
import { useEffect, useRef, useState } from 'react';

import { REFETCH_DISTANCE_THRESHOLD_M, hasMovedBeyond, type LatLng } from '@/shared/geo';

export function useFetchLocation(
  userLocation: LatLng | null,
  thresholdM: number = REFETCH_DISTANCE_THRESHOLD_M,
): LatLng | null {
  const [fetchLoc, setFetchLoc] = useState<LatLng | null>(userLocation);
  const lastFetchRef = useRef<LatLng | null>(userLocation);

  useEffect(() => {
    if (!userLocation) return;
    if (!hasMovedBeyond(lastFetchRef.current, userLocation, thresholdM)) return;
    lastFetchRef.current = userLocation;
    setFetchLoc(userLocation);
  }, [userLocation, thresholdM]);

  return fetchLoc;
}
