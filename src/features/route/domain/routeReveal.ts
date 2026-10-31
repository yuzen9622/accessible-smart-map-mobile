import type { FeatureCollection, LineString, Position } from 'geojson';

import { haversineMeters } from '@/shared/geo';

import type { RouteLineProps } from './routeLayerData';

type RouteLines = FeatureCollection<LineString, RouteLineProps>;

function cumulativeDistances(coords: Position[]): number[] {
  const distances = [0];
  for (let i = 1; i < coords.length; i++) {
    distances.push(distances[i - 1] + haversineMeters(
      { lat: coords[i - 1][1], lng: coords[i - 1][0] },
      { lat: coords[i][1], lng: coords[i][0] },
    ));
  }
  return distances;
}

function takeLength(coords: Position[], distances: number[], target: number): Position[] {
  // 找到繪線前端所在的邊；每幀只內插這一個端點，不重算整條路線的距離。
  let low = 1;
  let high = distances.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (distances[middle] < target) low = middle + 1;
    else high = middle;
  }
  const start = coords[low - 1];
  const end = coords[low];
  const step = distances[low] - distances[low - 1];
  const t = step === 0 ? 0 : (target - distances[low - 1]) / step;
  const visible = coords.slice(0, low);
  visible.push([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t]);
  return visible;
}

/**
 * 路線變更時準備一次距離索引，之後各幀只裁切當前線段；完成段直接共用原始 feature。
 * 底線依累積距離繪出，疊色與事故線等完成後才出現，避免超前於底線。
 */
export function createRouteReveal(lines: RouteLines): (progress: number) => RouteLines {
  let total = 0;
  const base = lines.features.filter((feature) => feature.properties.order === 0).map((feature) => {
    const distances = cumulativeDistances(feature.geometry.coordinates);
    const length = distances[distances.length - 1];
    const start = total;
    total += length;
    return { feature, distances, length, start };
  });
  const empty: RouteLines = { ...lines, features: [] };

  return (progress) => {
    if (progress >= 1) return lines;
    if (progress <= 0 || total === 0) return empty;
    const target = progress * total;
    const features: RouteLines['features'] = [];
    for (const { feature, distances, length, start } of base) {
      if (start >= target) break;
      if (length === 0) continue;
      if (start + length <= target) {
        features.push(feature);
        continue;
      }
      features.push({
        ...feature,
        geometry: { ...feature.geometry, coordinates: takeLength(feature.geometry.coordinates, distances, target - start) },
      });
      break;
    }
    return { ...lines, features };
  };
}
