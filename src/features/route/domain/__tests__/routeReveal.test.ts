import type { FeatureCollection, LineString } from 'geojson';

import type { RouteLineProps } from '../routeLayerData';
import { revealRouteLines } from '../routeReveal';

function collection(): FeatureCollection<LineString, RouteLineProps> {
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', geometry: { type: 'LineString', coordinates: [[121, 25], [121.01, 25]] }, properties: { id: 'a', kind: 'walk', color: '#000', order: 0 } },
      { type: 'Feature', geometry: { type: 'LineString', coordinates: [[121.01, 25], [121.02, 25]] }, properties: { id: 'b', kind: 'transit', color: '#000', order: 0 } },
      { type: 'Feature', geometry: { type: 'LineString', coordinates: [[121, 25], [121.005, 25]] }, properties: { id: 'c', kind: 'a11y', color: '#000', order: 1 } },
    ],
  };
}

describe('revealRouteLines', () => {
  it('returns the original collection when complete', () => {
    const lines = collection();
    expect(revealRouteLines(lines, 1)).toBe(lines);
  });

  it('draws nothing at progress 0', () => {
    expect(revealRouteLines(collection(), 0).features).toEqual([]);
  });

  it('truncates the first base line and hides later legs and overlays', () => {
    const result = revealRouteLines(collection(), 0.25);
    expect(result.features.map((f) => f.properties.id)).toEqual(['a']);
    const end = result.features[0].geometry.coordinates.at(-1);
    expect(end?.[0]).toBeCloseTo(121.005, 3);
  });

  it('keeps the first leg whole and starts the second at progress 0.75', () => {
    const result = revealRouteLines(collection(), 0.75);
    expect(result.features.map((f) => f.properties.id)).toEqual(['a', 'b']);
    expect(result.features[0].geometry.coordinates).toHaveLength(2);
    expect(result.features[1].geometry.coordinates.at(-1)?.[0]).toBeCloseTo(121.015, 3);
  });
});
