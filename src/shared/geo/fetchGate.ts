// 移植自 Web src/hook/useFetchLocation.ts（5eadc71）的純邏輯。
import { haversineMeters, type LatLng } from './geo';

/**
 * 位移門檻（公尺）：低於此距離的 GPS 更新不重新 fetch。
 * high-accuracy 定位約每 1~3 秒回一次 fix，站著不動也會抖動幾公尺；
 * 低於門檻的移動對「附近停車／設施」這類結果沒有意義，擋掉即可避免每個 fix 都打一次 API。
 */
export const REFETCH_DISTANCE_THRESHOLD_M = 100;

/**
 * 距上次 fetch 位置是否已移動超過 thresholdM。
 * - last 為 null（尚未查過／面板重掛載）→ true（需重查）。
 * - 位移 ≥ thresholdM → true；位移 < thresholdM（GPS 小抖動）→ false。
 */
export function hasMovedBeyond(
  last: LatLng | null,
  current: LatLng,
  thresholdM: number = REFETCH_DISTANCE_THRESHOLD_M,
): boolean {
  if (!last) return true;
  return haversineMeters(last, current) >= thresholdM;
}
