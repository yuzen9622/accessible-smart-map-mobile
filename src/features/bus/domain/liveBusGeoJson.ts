import type { Feature, FeatureCollection, Point } from 'geojson';

import type { LiveBus } from '../types/transit';
import type { AnimatedBus } from './busTween';

export interface LiveBusProps {
  plate: string;
  /** 1 = 低底盤／有升降設備（藍），0 = 其他（灰）。 */
  accessible: 0 | 1;
  bearing: number;
}

export const EMPTY_LIVE_BUSES: FeatureCollection<Point, LiveBusProps> = { type: 'FeatureCollection', features: [] };

/** 對齊 Web `LiveBusWrapper`：只畫目標車（`isTarget`），沒有任何一台被標記時退回全部。 */
export function selectDisplayBuses<T extends LiveBus>(buses: readonly T[]): T[] {
  const targets = buses.filter((b) => b.isTarget);
  return targets.length > 0 ? targets : [...buses];
}

export function isAccessibleBus(bus: Pick<LiveBus, 'isLowFloor' | 'hasLiftOrRamp'>): boolean {
  return bus.isLowFloor === '是' || bus.hasLiftOrRamp === '是';
}

export function liveBusCollection(buses: readonly AnimatedBus[]): FeatureCollection<Point, LiveBusProps> {
  if (buses.length === 0) return EMPTY_LIVE_BUSES;
  const features: Feature<Point, LiveBusProps>[] = buses.map((b) => ({
    type: 'Feature',
    id: b.plateNumb,
    geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
    properties: { plate: b.plateNumb, accessible: isAccessibleBus(b) ? 1 : 0, bearing: b.bearing },
  }));
  return { type: 'FeatureCollection', features };
}
