import type { FeatureCollection, LineString, Position } from 'geojson';

import { haversineMeters } from '@/shared/geo';

import type { RouteLineProps } from './routeLayerData';

function segmentLength(a: Position, b: Position): number {
  return haversineMeters({ lat: a[1], lng: a[0] }, { lat: b[1], lng: b[0] });
}

function lineLength(coords: Position[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) total += segmentLength(coords[i - 1], coords[i]);
  return total;
}

function takeLength(coords: Position[], target: number): Position[] {
  if (target <= 0) return [];
  const out: Position[] = [coords[0]];
  let walked = 0;
  for (let i = 1; i < coords.length; i++) {
    const step = segmentLength(coords[i - 1], coords[i]);
    if (walked + step >= target) {
      const t = step === 0 ? 0 : (target - walked) / step;
      out.push([coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t]);
      return out;
    }
    out.push(coords[i]);
    walked += step;
  }
  return out;
}

/**
 * 「路線繪出」動畫：只畫到整條路線 `progress`（0–1）的位置。底線（order 0）依各段累積長度裁切；
 * 疊色、事故等疊加線（order > 0）在畫完前不顯示，避免疊色比底線先出現。progress ≥ 1 原樣回傳。
 */
export function revealRouteLines(
  lines: FeatureCollection<LineString, RouteLineProps>,
  progress: number,
): FeatureCollection<LineString, RouteLineProps> {
  if (progress >= 1) return lines;
  const base = lines.features.filter((f) => f.properties.order === 0);
  const total = base.reduce((sum, f) => sum + lineLength(f.geometry.coordinates), 0);
  let remaining = Math.max(0, progress) * total;
  const features = base.flatMap((feature) => {
    const length = lineLength(feature.geometry.coordinates);
    const take = Math.min(remaining, length);
    remaining -= take;
    const coordinates = takeLength(feature.geometry.coordinates, take);
    return coordinates.length >= 2 ? [{ ...feature, geometry: { ...feature.geometry, coordinates } }] : [];
  });
  return { ...lines, features };
}
