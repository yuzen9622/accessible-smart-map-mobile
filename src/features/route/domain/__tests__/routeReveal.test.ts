import type { Feature, FeatureCollection, LineString, Position } from 'geojson';

import * as geo from '@/shared/geo/geo';

import type { RouteLineProps } from '../routeLayerData';
import { createRouteReveal } from '../routeReveal';

function line(id: string, coordinates: Position[]): Feature<LineString, RouteLineProps> {
  return { type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: { id, kind: 'walk', color: '#000', order: 0 } };
}

function collection(): FeatureCollection<LineString, RouteLineProps> {
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', geometry: { type: 'LineString', coordinates: [[121, 25], [121.01, 25]] }, properties: { id: 'a', kind: 'walk', color: '#000', order: 0 } },
      { type: 'Feature', geometry: { type: 'LineString', coordinates: [[121.01, 25], [121.02, 25]] }, properties: { id: 'b', kind: 'transit', color: '#000', order: 0 } },
      { type: 'Feature', geometry: { type: 'LineString', coordinates: [[121, 25], [121.005, 25]] }, properties: { id: 'c', kind: 'traffic', color: '#000', order: 1 } },
    ],
  };
}

describe('createRouteReveal', () => {
  it.each([1, 2])('returns the original collection at progress %s', (progress) => {
    const lines = collection();
    expect(createRouteReveal(lines)(progress)).toBe(lines);
  });

  it.each([0, -0.5])('draws nothing at progress %s', (progress) => {
    expect(createRouteReveal(collection())(progress).features).toEqual([]);
  });

  it('truncates the first base line and hides later legs and overlays', () => {
    const result = createRouteReveal(collection())(0.25);
    expect(result.features.map((f) => f.properties.id)).toEqual(['a']);
    const end = result.features[0].geometry.coordinates.at(-1);
    expect(end?.[0]).toBeCloseTo(121.005, 3);
  });

  it('keeps the first leg whole and starts the second at progress 0.75', () => {
    const lines = collection();
    const result = createRouteReveal(lines)(0.75);
    expect(result.features.map((f) => f.properties.id)).toEqual(['a', 'b']);
    expect(result.features[0]).toBe(lines.features[0]);
    expect(result.features[1].geometry.coordinates.at(-1)?.[0]).toBeCloseTo(121.015, 3);
  });

  it('advances across unequal legs by distance and keeps overlays hidden until completion', () => {
    const lines = collection();
    lines.features[1].geometry.coordinates = [[121.01, 25], [121.04, 25]];
    const reveal = createRouteReveal(lines);

    const halfway = reveal(0.5);
    expect(halfway.features.map((feature) => feature.properties.id)).toEqual(['a', 'b']);
    expect(halfway.features[0]).toBe(lines.features[0]);
    expect(halfway.features[1].geometry.coordinates.at(-1)?.[0]).toBeCloseTo(121.02, 6);
    expect(reveal(0.999).features.map((feature) => feature.properties.id)).toEqual(['a', 'b']);
    expect(reveal(1)).toBe(lines);
  });

  it('handles repeated coordinates and zero-length legs without blocking later geometry', () => {
    const lines: FeatureCollection<LineString, RouteLineProps> = {
      type: 'FeatureCollection',
      features: [
        line('stationary', [[121, 25], [121, 25]]),
        line('moving', [[121, 25], [121, 25], [121.01, 25], [121.01, 25], [121.02, 25]]),
      ],
    };
    const reveal = createRouteReveal(lines);
    for (const progress of [0.25, 0.5, 0.75]) {
      const result = reveal(progress);
      const moving = result.features.find((feature) => feature.properties.id === 'moving');
      expect(moving?.geometry.coordinates.at(-1)?.[0]).toBeCloseTo(121 + 0.02 * progress, 6);
      expect(result.features.flatMap((feature) => feature.geometry.coordinates).flat().every(Number.isFinite)).toBe(true);
    }
    expect(reveal(1)).toBe(lines);
  });

  it('handles a route containing only zero-length geometry', () => {
    const lines: FeatureCollection<LineString, RouteLineProps> = {
      type: 'FeatureCollection',
      features: [line('stationary', [[121, 25], [121, 25]])],
    };
    const reveal = createRouteReveal(lines);
    expect(reveal(0).features).toEqual([]);
    expect(reveal(0.5).features).toEqual([]);
    expect(reveal(1)).toBe(lines);
  });

  it('handles an empty collection at every stage', () => {
    const lines: FeatureCollection<LineString, RouteLineProps> = { type: 'FeatureCollection', features: [] };
    const reveal = createRouteReveal(lines);
    expect(reveal(0).features).toEqual([]);
    expect(reveal(0.5).features).toEqual([]);
    expect(reveal(1)).toBe(lines);
  });

  it('prepares real distances once and reuses them across animation frames', () => {
    const distance = jest.spyOn(geo, 'haversineMeters');
    try {
      const reveal = createRouteReveal(collection());
      expect(distance).toHaveBeenCalled();
      distance.mockClear();

      for (const progress of [0, 0.1, 0.25, 0.5, 0.75, 0.999, 1]) reveal(progress);

      expect(distance).not.toHaveBeenCalled();
    } finally {
      distance.mockRestore();
    }
  });
});
