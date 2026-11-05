import type { LineLayerSpecification } from '@maplibre/maplibre-react-native';
import type { Feature, LineString } from 'geojson';

import { routeCasingColor } from '@/shared/theme/palettes';
import type { AccessibleRoute, LngLatTuple } from '../types/route';
import { getLegColor, TRAFFIC_LEVEL_COLORS, visibleTrafficSegments } from './routeDisplay';

type Gradient = NonNullable<LineLayerSpecification['paint']>['line-gradient'];
interface TrafficGradient {
  id: string;
  data: Feature<LineString>;
  gradient: Gradient;
  casingGradient: Gradient;
}

// line-progress uses Web Mercator distance, not vertex count or geodesic distance.
function project([lng, lat]: LngLatTuple): [number, number] {
  const radians = Math.PI / 180;
  return [lng * radians * 6378137, Math.log(Math.tan(Math.PI / 4 + lat * radians / 2)) * 6378137];
}

/** One source per road leg: native line-gradient cannot read per-feature properties. */
export function buildTrafficGradients(route: AccessibleRoute | null): TrafficGradient[] {
  return (route?.legs ?? []).flatMap((leg, legIndex) => {
    if (leg.type !== 'DRIVE' && leg.type !== 'MOTORCYCLE') return [];
    const coords = leg.polyline ?? [];
    // Keep traffic indexes tied to the original geometry; never shift them by filtering points.
    if (coords.length < 2 || coords.some(([lng, lat]) => !Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lat) >= 85.051129)) return [];
    const segments = visibleTrafficSegments(leg.trafficSegments, coords.length);
    if (!segments.length) return [];
    const colors: string[] = Array(coords.length - 1).fill(getLegColor(leg));
    for (const segment of segments) {
      colors.fill(TRAFFIC_LEVEL_COLORS[segment.trafficLevel], segment.fromIndex, segment.toIndex);
    }
    const projected = coords.map(project);
    const distances = [0];
    for (let i = 1; i < projected.length; i++) {
      distances.push(distances[i - 1] + Math.hypot(projected[i][0] - projected[i - 1][0], projected[i][1] - projected[i - 1][1]));
    }
    const total = distances[distances.length - 1];
    if (total <= 0) return [];
    const spans: { start: number; end: number; color: string }[] = [];
    colors.forEach((color, i) => {
      if (distances[i + 1] <= distances[i]) return;
      const previous = spans[spans.length - 1];
      if (previous?.color === color) previous.end = distances[i + 1];
      else spans.push({ start: distances[i], end: distances[i + 1], color });
    });
    // Up to 30 m on either side; short segments retain at least half their solid color.
    const transition = 30 / Math.cos(coords[0][1] * Math.PI / 180);
    const stops: [number, string][] = [[0, spans[0].color]];
    for (let i = 1; i < spans.length; i++) {
      const before = spans[i - 1];
      const after = spans[i];
      const width = Math.min(transition, (before.end - before.start) / 4, (after.end - after.start) / 4);
      stops.push([(after.start - width) / total, before.color], [(after.start + width) / total, after.color]);
    }
    stops.push([1, spans[spans.length - 1].color]);
    const gradient = (casing: boolean): Gradient => [
      'interpolate', ['linear'], ['line-progress'],
      ...stops.flatMap(([progress, color]) => [progress, casing ? routeCasingColor(color, 'light') : color]),
    ];
    const id = `route-traffic-${legIndex}`;
    return [{
      id,
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
      gradient: gradient(false), casingGradient: gradient(true),
    }];
  });
}
