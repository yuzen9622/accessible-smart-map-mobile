import type { LineLayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import { campusRoadLayers } from '../campusRoadStyle';

it('reuses the basemap road widths, zoom ranges and dash pattern without changing the source style', () => {
  const path: LineLayerSpecification = { id: 'road_path_pedestrian', type: 'line', source: 'basemap', 'source-layer': 'transportation', minzoom: 12,
    layout: { 'line-cap': 'round' }, paint: { 'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 14, 1, 20, 10], 'line-dasharray': [1, 0.7] } };
  const service: LineLayerSpecification = { ...path, id: 'road_service_track' };
  const casing: LineLayerSpecification = { ...path, id: 'road_service_track_casing' };
  const layers = [path, casing, service];
  const snapshot = JSON.stringify(layers);
  const result = campusRoadLayers(layers);
  expect(result).toHaveLength(3);
  expect(result[0]).toMatchObject({ minzoom: 12, paint: path.paint, layout: path.layout, filter: ['==', ['get', 'roadClass'], 'path'] });
  expect(result.every((layer) => layer['source-layer'] === undefined)).toBe(true);
  expect(JSON.stringify(layers)).toBe(snapshot);
});

it('supports the alternate basemap style and does not invent missing road layers', () => {
  expect(campusRoadLayers([])).toEqual([]);
  const result = campusRoadLayers([{ id: 'highway_path', type: 'line', source: 'base' }, { id: 'highway_minor', type: 'line', source: 'base' }]);
  expect(result.map((layer) => layer.filter)).toEqual([['==', ['get', 'roadClass'], 'path'], ['==', ['get', 'roadClass'], 'service']]);
});
